import { supabase } from '../lib/supabase';
import { getSessionEmployee, logAudit } from './session';
import { mapAsset, mapAssetAssignment, mapItRequest } from './mappers';
import type {
  Asset,
  AssetAssignment,
  AssetCondition,
  ItRequest,
  ItRequestStatus,
  ItRequestType
} from '../types';

const ASSET_SELECT = '*, assignee:employees!assets_assigned_to_fkey(full_name, emp_code)';
const REQUEST_SELECT =
  '*, employee:employees!it_requests_employee_id_fkey(full_name, emp_code), raiser:employees!it_requests_raised_by_fkey(full_name)';

export type AssetInput = Omit<
  Asset,
  'id' | 'status' | 'assignedTo' | 'assignedToName' | 'assignedToCode' | 'assignedAt' | 'acknowledgedAt'
> & { status?: Asset['status'] };

function toAssetRow(a: Partial<AssetInput>) {
  const row: Record<string, unknown> = {};
  const set = (key: string, v: unknown) => {
    if (v !== undefined) row[key] = v === '' ? null : v;
  };
  set('asset_tag', a.assetTag);
  set('category', a.category);
  set('brand', a.brand);
  set('model', a.model);
  set('serial_number', a.serialNumber);
  set('imei', a.imei);
  set('phone_number', a.phoneNumber);
  set('carrier', a.carrier);
  set('plan_details', a.planDetails);
  set('specs', a.specs);
  set('purchase_date', a.purchaseDate);
  set('purchase_cost', a.purchaseCost);
  set('vendor', a.vendor);
  set('warranty_until', a.warrantyUntil);
  set('condition', a.condition);
  set('status', a.status);
  set('notes', a.notes);
  return row;
}

export const itApi = {
  async getAssets(): Promise<Asset[]> {
    const { data, error } = await supabase.from('assets').select(ASSET_SELECT).order('asset_tag');
    if (error) throw new Error(`Failed to load assets: ${error.message}`);
    return (data ?? []).map(mapAsset);
  },

  async createAsset(input: AssetInput): Promise<Asset> {
    const me = await getSessionEmployee();
    const { data, error } = await supabase
      .from('assets')
      .insert(toAssetRow({ ...input, status: input.status ?? 'IN_STOCK' }) as any)
      .select(ASSET_SELECT)
      .single();
    if (error || !data) {
      if (error?.code === '23505') throw new Error('Asset tag or mobile number already exists in the register.');
      throw new Error(`Failed to add asset: ${error?.message}`);
    }
    await logAudit(me, 'EMPLOYEE', 'ASSET_CREATED', `Added ${input.category} ${input.assetTag}`, { type: 'asset', id: data.id });
    return mapAsset(data);
  },

  async updateAsset(id: number, input: Partial<AssetInput>): Promise<Asset> {
    const { data, error } = await supabase
      .from('assets')
      .update(toAssetRow(input) as any)
      .eq('id', id)
      .select(ASSET_SELECT)
      .single();
    if (error || !data) {
      if (error?.code === '23505') throw new Error('Asset tag or mobile number already exists in the register.');
      throw new Error(`Failed to update asset: ${error?.message}`);
    }
    return mapAsset(data);
  },

  async assignAsset(assetId: number, employeeId: number, notes?: string): Promise<void> {
    const me = await getSessionEmployee();
    const now = new Date().toISOString();

    const { data: asset, error: findError } = await supabase
      .from('assets')
      .select('id, asset_tag, status')
      .eq('id', assetId)
      .single();
    if (findError || !asset) throw new Error(`Asset not found: ${findError?.message}`);
    if (asset.status !== 'IN_STOCK') {
      throw new Error(`Asset ${asset.asset_tag} is ${asset.status.replace('_', ' ').toLowerCase()} — return it to stock first.`);
    }

    const { error } = await supabase
      .from('assets')
      .update({ status: 'ASSIGNED', assigned_to: employeeId, assigned_at: now, acknowledged_at: null })
      .eq('id', assetId)
      .eq('status', 'IN_STOCK');
    if (error) throw new Error(`Failed to assign asset: ${error.message}`);

    const { error: histError } = await supabase.from('asset_assignments').insert({
      asset_id: assetId,
      employee_id: employeeId,
      assigned_at: now,
      assigned_by: me.id,
      notes: notes || null
    });
    if (histError) throw new Error(`Asset assigned but history not recorded: ${histError.message}`);

    await logAudit(me, 'EMPLOYEE', 'ASSET_ASSIGNED', `${asset.asset_tag} → employee #${employeeId}`, { type: 'asset', id: assetId });
  },

  async returnAsset(assetId: number, condition: AssetCondition, notes?: string): Promise<void> {
    const me = await getSessionEmployee();
    const now = new Date().toISOString();

    const { error: histError } = await supabase
      .from('asset_assignments')
      .update({ returned_at: now, return_condition: condition, notes: notes || null })
      .eq('asset_id', assetId)
      .is('returned_at', null);
    if (histError) throw new Error(`Failed to close assignment: ${histError.message}`);

    const { error } = await supabase
      .from('assets')
      .update({
        status: condition === 'DAMAGED' ? 'IN_REPAIR' : 'IN_STOCK',
        condition,
        assigned_to: null,
        assigned_at: null,
        acknowledged_at: null
      })
      .eq('id', assetId);
    if (error) throw new Error(`Failed to return asset: ${error.message}`);

    await logAudit(me, 'EMPLOYEE', 'ASSET_RETURNED', `Asset #${assetId} returned (${condition})`, { type: 'asset', id: assetId });
  },

  async getAssetHistory(assetId: number): Promise<AssetAssignment[]> {
    const { data, error } = await supabase
      .from('asset_assignments')
      .select(
        '*, employee:employees!asset_assignments_employee_id_fkey(full_name), assigner:employees!asset_assignments_assigned_by_fkey(full_name)'
      )
      .eq('asset_id', assetId)
      .order('assigned_at', { ascending: false });
    if (error) throw new Error(`Failed to load asset history: ${error.message}`);
    return (data ?? []).map(mapAssetAssignment);
  },

  async getRequests(): Promise<ItRequest[]> {
    const { data, error } = await supabase
      .from('it_requests')
      .select(REQUEST_SELECT)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load IT requests: ${error.message}`);
    return (data ?? []).map(mapItRequest);
  },

  async raiseRequest(data: {
    employeeId?: number;
    requestType: ItRequestType;
    title: string;
    details?: string;
    priority?: ItRequest['priority'];
  }): Promise<ItRequest> {
    const me = await getSessionEmployee();
    const { data: created, error } = await supabase
      .from('it_requests')
      .insert({
        employee_id: data.employeeId ?? me.id,
        request_type: data.requestType,
        title: data.title,
        details: data.details || null,
        priority: data.priority ?? 'MEDIUM',
        raised_by: me.id
      })
      .select(REQUEST_SELECT)
      .single();
    if (error || !created) throw new Error(`Failed to raise IT request: ${error?.message}`);
    return mapItRequest(created);
  },

  async updateRequestStatus(id: number, status: ItRequestStatus, resolution?: string): Promise<void> {
    const closing = status === 'DONE' || status === 'CANCELLED';
    const { error } = await supabase
      .from('it_requests')
      .update({
        status,
        resolution: resolution || null,
        closed_at: closing ? new Date().toISOString() : null
      })
      .eq('id', id);
    if (error) throw new Error(`Failed to update IT request: ${error.message}`);
  },

  // ---- Employee self-service ------------------------------------------------

  async getMyAssets(): Promise<Asset[]> {
    const me = await getSessionEmployee();
    const { data, error } = await supabase
      .from('assets')
      .select(ASSET_SELECT)
      .eq('assigned_to', me.id)
      .order('category');
    if (error) throw new Error(`Failed to load your assets: ${error.message}`);
    return (data ?? []).map(mapAsset);
  },

  async getMyRequests(): Promise<ItRequest[]> {
    const me = await getSessionEmployee();
    const { data, error } = await supabase
      .from('it_requests')
      .select(REQUEST_SELECT)
      .or(`employee_id.eq.${me.id},raised_by.eq.${me.id}`)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load your IT requests: ${error.message}`);
    return (data ?? []).map(mapItRequest);
  },

  async acknowledgeAsset(assetId: number): Promise<void> {
    const { error } = await (supabase.rpc as any)('acknowledge_asset', { p_asset_id: assetId });
    if (error) throw new Error(`Failed to acknowledge asset: ${error.message}`);
  }
};
