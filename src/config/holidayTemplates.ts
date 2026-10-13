/**
 * Suggested holiday lists (Maharashtra / Pune HQ). HR reviews and imports these
 * from Holiday Calendar → "Load holiday list". Festival dates that follow the lunar
 * calendar are marked `tentative` — confirm against the state gazette before import.
 */
export interface HolidayTemplate {
  date: string;
  name: string;
  optional?: boolean;
  tentative?: boolean;
}

export const HOLIDAY_TEMPLATES: Record<number, HolidayTemplate[]> = {
  2026: [
    { date: '2026-01-01', name: "New Year's Day", optional: true },
    { date: '2026-01-14', name: 'Makar Sankranti', optional: true },
    { date: '2026-01-26', name: 'Republic Day' },
    { date: '2026-02-15', name: 'Maha Shivratri', optional: true, tentative: true },
    { date: '2026-02-19', name: 'Chhatrapati Shivaji Maharaj Jayanti', optional: true },
    { date: '2026-03-04', name: 'Holi', tentative: true },
    { date: '2026-03-19', name: 'Gudi Padwa', tentative: true },
    { date: '2026-03-21', name: 'Eid-ul-Fitr', optional: true, tentative: true },
    { date: '2026-03-26', name: 'Ram Navami', optional: true, tentative: true },
    { date: '2026-03-31', name: 'Mahavir Jayanti', optional: true, tentative: true },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-04-14', name: 'Dr. Ambedkar Jayanti', optional: true },
    { date: '2026-05-01', name: 'Maharashtra Day' },
    { date: '2026-05-27', name: 'Bakri Eid (Eid-al-Adha)', optional: true, tentative: true },
    { date: '2026-08-15', name: 'Independence Day' },
    { date: '2026-08-28', name: 'Raksha Bandhan', optional: true, tentative: true },
    { date: '2026-09-14', name: 'Ganesh Chaturthi', tentative: true },
    { date: '2026-10-02', name: 'Gandhi Jayanti' },
    { date: '2026-10-20', name: 'Dussehra', tentative: true },
    { date: '2026-11-08', name: 'Diwali (Lakshmi Puja)', tentative: true },
    { date: '2026-11-09', name: 'Diwali (Balipratipada)', tentative: true },
    { date: '2026-11-24', name: 'Guru Nanak Jayanti', optional: true, tentative: true },
    { date: '2026-12-25', name: 'Christmas' }
  ],
  2027: [
    { date: '2027-01-01', name: "New Year's Day", optional: true },
    { date: '2027-01-14', name: 'Makar Sankranti', optional: true, tentative: true },
    { date: '2027-01-26', name: 'Republic Day' },
    { date: '2027-02-19', name: 'Chhatrapati Shivaji Maharaj Jayanti', optional: true },
    { date: '2027-03-06', name: 'Maha Shivratri', optional: true, tentative: true },
    { date: '2027-03-10', name: 'Eid-ul-Fitr', optional: true, tentative: true },
    { date: '2027-03-22', name: 'Holi', tentative: true },
    { date: '2027-03-26', name: 'Good Friday' },
    { date: '2027-04-07', name: 'Gudi Padwa', tentative: true },
    { date: '2027-04-14', name: 'Dr. Ambedkar Jayanti', optional: true },
    { date: '2027-05-01', name: 'Maharashtra Day' },
    { date: '2027-05-17', name: 'Bakri Eid (Eid-al-Adha)', optional: true, tentative: true },
    { date: '2027-08-15', name: 'Independence Day' },
    { date: '2027-08-17', name: 'Raksha Bandhan', optional: true, tentative: true },
    { date: '2027-09-04', name: 'Ganesh Chaturthi', tentative: true },
    { date: '2027-10-02', name: 'Gandhi Jayanti' },
    { date: '2027-10-09', name: 'Dussehra', tentative: true },
    { date: '2027-10-29', name: 'Diwali (Lakshmi Puja)', tentative: true },
    { date: '2027-11-14', name: 'Guru Nanak Jayanti', optional: true, tentative: true },
    { date: '2027-12-25', name: 'Christmas' }
  ]
};
