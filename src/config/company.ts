/** Legal entity details printed on payslips. */
export const COMPANY = {
  legalName: 'Remote Healthcare Technologies Pvt. Ltd.',
  brandName: 'SecondMedic',
  cin: 'U85110PN2020PTC192841',
  addressLine: 'Baner Bio-Tech Park, Pancard Club Road, Baner, Pune, Maharashtra - 411045',
  website: 'www.secondmedic.com',
  email: 'accounts@secondmedic.com',
  /** Served from /public. */
  logoUrl: '/company-logo.webp',
  /** Printed as "Division" when an employee has none recorded. */
  defaultDivision: 'Maharashtra',
} as const;

