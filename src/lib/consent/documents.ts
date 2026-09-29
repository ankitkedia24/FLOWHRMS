/**
 * The notices and policies people consent to — DRAFTS pending legal review.
 *
 * Written against the Digital Personal Data Protection Act, 2023 (ss. 5, 6,
 * 7, 8, 9, 11–14) and the DPDP Rules, 2025 (Rule 3: a notice must stand on
 * its own, give an itemised description of the personal data and the
 * specified purpose, describe the service, and say how to withdraw consent,
 * exercise rights and complain to the Board). See docs/md/DPDP-COMPLIANCE.md.
 *
 * These are the SOURCE. What a person actually saw is the published copy in
 * `consent_notices` (scripts/publish-notices.ts), whose sha256 every consent
 * record carries. Changing any text here therefore requires a new `version`:
 * the publish script refuses to re-publish a changed text under an old
 * version number, and publishing a new version makes everyone re-consent.
 *
 * Pure data, no imports: shared by server code, pages and tests.
 */

export type DocumentKey =
  | "account_holder"
  | "customer_terms"
  | "employee"
  | "terms"
  | "privacy";

export interface Purpose {
  key: string;
  label: string;
  required: boolean;
}

export interface DocumentSection {
  heading: string;
  paragraphs?: string[];
  items?: string[];
  /** Itemised data: [what, why]. */
  rows?: Array<[string, string]>;
}

export interface ConsentDocument {
  key: DocumentKey;
  version: number;
  language: "en";
  title: string;
  summary: string;
  sections: DocumentSection[];
  /** Consent notices only: the boxes a person ticks. */
  purposes: Purpose[];
}

export const CONTROLLER = {
  name: "Flowacord",
  product: "FlowHRMS",
  site: "https://hrms.flowacord.com",
  email: "help@flowacord.com",
  phone: "+91 89088 88880",
  grievanceOfficer: "Grievance Officer, Flowacord",
} as const;

const RIGHTS_SECTION: DocumentSection = {
  heading: "Your rights and how to use them",
  paragraphs: [
    "Under the Digital Personal Data Protection Act, 2023 you may:",
  ],
  items: [
    "ask for a summary of the personal data we hold about you and how it is used;",
    "ask us to correct, complete or update it;",
    "ask us to erase it, where it is no longer needed and the law does not require us to keep it;",
    "withdraw your consent at any time — as easily as you gave it — from Account → Privacy & consent after signing in, or by writing to us;",
    "nominate another person to exercise these rights if you die or become unable to;",
    "raise a grievance with us. We respond within 90 days.",
  ],
};

const GRIEVANCE_SECTION: DocumentSection = {
  heading: "Questions, grievances and complaints",
  paragraphs: [
    `Contact our ${CONTROLLER.grievanceOfficer}: ${CONTROLLER.email}, ${CONTROLLER.phone}. Signed-in users can also raise a request from Account → Privacy & consent.`,
    "If you are not satisfied with our response, you may complain to the Data Protection Board of India through the online process it provides. Current details are published by the Ministry of Electronics and Information Technology at https://www.meity.gov.in.",
  ],
};

/** Flowacord is the Data Fiduciary for the registrant's own details. */
const ACCOUNT_HOLDER_V1: ConsentDocument = {
  key: "account_holder",
  version: 1,
  language: "en",
  title: "Privacy notice for your FlowHRMS account",
  summary:
    "Flowacord will use the personal data listed below to create and run your FlowHRMS account and free trial. This notice says what we collect, why, how long we keep it, and how to withdraw consent or use your rights.",
  sections: [
    {
      heading: "Who is responsible",
      paragraphs: [
        `${CONTROLLER.name} provides ${CONTROLLER.product} (${CONTROLLER.site}), an attendance, leave, task and payroll-input system for businesses. For the personal data you give us about yourself when you register, ${CONTROLLER.name} is the Data Fiduciary under the Digital Personal Data Protection Act, 2023.`,
      ],
    },
    {
      heading: "The personal data we collect and why",
      rows: [
        ["Your name", "To identify you in the account and in messages we send you."],
        ["Your email address", "To sign you in, verify the address, and send account, trial and security messages."],
        ["Your mobile number", "To contact you about your account and give support."],
        ["Your role in the company", "To set up your access correctly."],
        ["Company name, staff count, industry and address (pincode, city, state)", "To set up the company account. This is personal data where it identifies you, for example as a sole proprietor."],
        ["How you heard about us (optional)", "To understand which ways of finding FlowHRMS work."],
        ["IP address, device and browser details, and the time you registered and consented", "For security and fraud prevention, and to keep proof of the consent you give on this page."],
      ],
    },
    {
      heading: "The service",
      paragraphs: [
        `${CONTROLLER.product} lets a business record attendance (with location only at check-in and check-out), leave, tasks and proof of work, and prepare payroll inputs and payslips. New companies start with a 30-day free trial; continuing afterwards requires a paid plan.`,
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "We keep your account data while your account is open. After it is closed we erase or anonymise it within 90 days, except what the law requires us to keep (for example tax and accounting records) and the record of your consent, which we keep for as long as we may need to show that we obtained it.",
      ],
    },
    {
      heading: "Who we share it with",
      paragraphs: [
        "We do not sell your personal data. Service providers who host and operate FlowHRMS for us — cloud hosting, database and sign-in, and email delivery — process it on our instructions under contract. We disclose data to authorities only where the law requires it.",
      ],
    },
    RIGHTS_SECTION,
    {
      heading: "If you withdraw consent",
      paragraphs: [
        "Withdrawing consent for product updates only stops those messages. Withdrawing consent for running your account means we stop processing your data for it and close the account; your company's data is then handled as described in the Terms of Service. Processing done before you withdrew remains lawful.",
      ],
    },
    GRIEVANCE_SECTION,
    {
      heading: "Language",
      paragraphs: [
        "This notice is available in English. To receive it in any language listed in the Eighth Schedule to the Constitution of India, write to us.",
      ],
    },
  ],
  purposes: [
    {
      key: "account_service",
      label: "Use my details to create and run my FlowHRMS account and free trial, including service and security messages.",
      required: true,
    },
    {
      key: "security_legal",
      label: "Keep security logs and proof of this consent, and meet legal obligations.",
      required: true,
    },
    {
      key: "product_updates",
      label: "Send me product updates and offers by email or WhatsApp. (Optional — you can use FlowHRMS without this.)",
      required: false,
    },
  ],
};

/** What the registrant confirms about themselves and the company. */
const CUSTOMER_TERMS_V1: ConsentDocument = {
  key: "customer_terms",
  version: 1,
  language: "en",
  title: "Registering a company on FlowHRMS",
  summary:
    "By registering a company you confirm who you are, that you may act for the company, and that the company is responsible for its employees' personal data in FlowHRMS.",
  sections: [
    {
      heading: "Who is responsible for employees' data",
      paragraphs: [
        "Your company will enter and collect its employees' personal data in FlowHRMS — names and contact details, attendance times, location at the moment of check-in and check-out, leave, tasks and photos, salary and payslips, and documents. For that data your company is the Data Fiduciary under the Digital Personal Data Protection Act, 2023. Flowacord processes it only on your company's instructions, as its Data Processor, under the Terms of Service.",
        "FlowHRMS shows every employee a notice describing this processing when they activate their account, and records their acknowledgement. Your company remains responsible for having a lawful basis for its processing and for answering its employees' requests about their records.",
      ],
    },
    {
      heading: "Children",
      paragraphs: [
        "FlowHRMS is not for use by anyone under 18 without verifiable consent of a parent or lawful guardian. Do not add an employee under 18 unless your company has that consent.",
      ],
    },
    GRIEVANCE_SECTION,
  ],
  purposes: [
    { key: "age_18", label: "I am 18 years of age or older.", required: true },
    {
      key: "authority",
      label: "I am authorised to register this company and to accept the Terms of Service on its behalf.",
      required: true,
    },
    {
      key: "accept_terms",
      label: "I have read and accept the Terms of Service and the Privacy Policy.",
      required: true,
    },
    {
      key: "fiduciary_role",
      label: "I understand that my company is responsible (as Data Fiduciary) for its employees' personal data in FlowHRMS, and that Flowacord processes it on the company's instructions.",
      required: true,
    },
  ],
};

/** Shown to every employee when they activate their account. */
const EMPLOYEE_V1: ConsentDocument = {
  key: "employee",
  version: 1,
  language: "en",
  title: "Notice to employees: how your work records are used",
  summary:
    "Your employer uses FlowHRMS for attendance, leave, tasks and pay. This notice lists the personal data about you that is recorded, why, and how to ask questions or withdraw consent.",
  sections: [
    {
      heading: "Who is responsible",
      paragraphs: [
        "Your employer (the company that invited you) decides how your work records are used and is the Data Fiduciary for them. Flowacord runs FlowHRMS and processes the records only on your employer's instructions.",
      ],
    },
    {
      heading: "The personal data recorded and why",
      rows: [
        ["Name, mobile number and email address", "To create your account, sign you in and contact you about work."],
        ["Employee code, designation, department, manager, joining date and employment type", "To keep your employment record and route your requests to the right person."],
        ["Check-in and check-out times", "To record attendance and calculate pay."],
        ["Your location — only at the moment you check in and check out, never continuously", "To confirm you were at a permitted place of work. It is not tracked at any other time."],
        ["Photos and files you upload as proof of work", "To show a task was completed."],
        ["Leave requests and the reasons you give", "For your manager to approve or decline leave."],
        ["Salary, payslips, adjustments and bank details if provided", "To prepare your pay."],
        ["Documents you or HR upload (for example ID or address proof)", "To keep required employment records."],
        ["Device, IP address and time of sign-in", "For security, and to keep proof of this acknowledgement."],
      ],
    },
    {
      heading: "How long it is kept",
      paragraphs: [
        "Your employer keeps your records for as long as it needs them for your employment and as the law requires (for example wage and tax records). Ask your employer about its retention.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "You may ask for a summary of your data, ask for corrections or erasure, withdraw consent, nominate someone, and raise a grievance. Ask your employer's admin or HR first; you can also raise a request from Account → Privacy & consent and Flowacord will pass it to your employer. Some processing for employment purposes is allowed by law without consent; withdrawing consent does not affect that, and withdrawing consent for location means your check-ins go to your manager for approval.",
      ],
    },
    GRIEVANCE_SECTION,
  ],
  purposes: [
    {
      key: "work_records",
      label: "I have read this notice and consent to my employer using my work records as described, for attendance, leave, tasks, pay and HR administration.",
      required: true,
    },
    {
      key: "checkin_location",
      label: "I consent to my location being captured only at the moment I check in and check out.",
      required: true,
    },
  ],
};

/**
 * Version 2 (27 Sept 2026): adds the profile photograph and blood group,
 * collected for the employee ID card. A new data item needs a new notice,
 * so everyone re-consents once (DPDP Act s.5, s.6).
 */
const EMPLOYEE_V2: ConsentDocument = {
  ...EMPLOYEE_V1,
  version: 2,
  sections: EMPLOYEE_V1.sections.map((section) =>
    section.heading === "The personal data recorded and why" && section.rows
      ? {
          ...section,
          rows: [
            ...section.rows.slice(0, 2),
            [
              "Your photograph, and your blood group if you give it",
              "For your employee ID card and profile, so colleagues and visitors can recognise you, and for emergencies.",
            ],
            ...section.rows.slice(2),
          ],
        }
      : section,
  ),
};

/**
 * Version 3 (29 Sept 2026): location at field-visit taps, for companies
 * that use field visits (FIELD-VISITS-MODULE.md §9). Still never
 * continuous and never between taps, and a consent of its own that may be
 * refused: visits are then recorded without location.
 */
const EMPLOYEE_V3: ConsentDocument = {
  ...EMPLOYEE_V2,
  version: 3,
  sections: EMPLOYEE_V2.sections.map((section) => {
    if (section.heading === "The personal data recorded and why" && section.rows) {
      return {
        ...section,
        rows: section.rows.flatMap(([what, why]): Array<[string, string]> =>
          what.startsWith("Your location")
            ? [
                [
                  "Your location — only at the moment you check in and check out and, if your company uses field visits, when you tap Going out, Reached, End visit or Back at office. Never continuously, and never between taps",
                  "To confirm you were at a permitted place of work, and to record where you went on a field visit and the road distance travelled, for travel allowance. It is not tracked at any other time.",
                ],
                [
                  "Field visits, if your company uses them: the places you visit, the times, the purpose, and any note or photo you add",
                  "So your manager knows where you went during working hours and can approve the trip, and to pay travel allowance.",
                ],
              ]
            : [[what, why]],
        ),
      };
    }
    if (section.heading === "Your rights" && section.paragraphs) {
      return {
        ...section,
        paragraphs: section.paragraphs.map((p) =>
          p.replace(
            "withdrawing consent for location means your check-ins go to your manager for approval.",
            "withdrawing consent for location means your check-ins go to your manager for approval, and your field visits are recorded without location, so their travel distance can't be worked out.",
          ),
        ),
      };
    }
    return section;
  }),
  purposes: [
    ...EMPLOYEE_V2.purposes,
    {
      key: "visit_location",
      label:
        "If my company uses field visits, I consent to my location being captured each time I tap Going out, Reached, End visit or Back at office — never in between.",
      required: false,
    },
  ],
};

const TERMS_V1: ConsentDocument = {
  key: "terms",
  version: 1,
  language: "en",
  title: "FlowHRMS Terms of Service",
  summary: `These terms govern your company's use of ${CONTROLLER.product}, provided by ${CONTROLLER.name}. By registering a company you accept them on its behalf.`,
  sections: [
    {
      heading: "1. The service",
      paragraphs: [
        `${CONTROLLER.product} is an online system for attendance (including location at check-in and check-out), leave, tasks and proof of work, payroll inputs and payslips, and related HR records. Features available to your company are those switched on for its account.`,
      ],
    },
    {
      heading: "2. Free trial",
      paragraphs: [
        "A new company receives a free trial, normally 30 days. We may change the features included in a trial. When the trial ends, access pauses until the company moves to a paid plan; the company's data is kept and becomes available again when access resumes. We may extend or end a trial at our discretion.",
      ],
    },
    {
      heading: "3. Accounts and security",
      paragraphs: [
        "You are responsible for the accounts your company creates, for keeping passwords confidential, and for what is done through them. Tell us promptly at " + CONTROLLER.email + " if you believe an account has been misused.",
      ],
    },
    {
      heading: "4. Your company's responsibilities",
      items: [
        "use FlowHRMS lawfully and only for managing your own workforce;",
        "give employees notice of how their data is processed and have a lawful basis for it (FlowHRMS shows each employee a notice when they activate their account);",
        "not add anyone under 18 without verifiable consent of a parent or lawful guardian;",
        "check payroll, tax and statutory figures with your accountant — FlowHRMS prepares inputs and does not certify statutory compliance;",
        "not attempt to break, overload, or gain unauthorised access to the service.",
      ],
    },
    {
      heading: "5. Personal data",
      paragraphs: [
        "For employees' personal data your company is the Data Fiduciary and Flowacord is its Data Processor: we process that data only to provide the service, on your company's instructions, keep it secure, use sub-processors (hosting, database, email) under contract, help your company respond to employees' requests, and tell your company without undue delay if we become aware of a personal data breach affecting it. For your own account data Flowacord is the Data Fiduciary, as described in the Privacy Policy.",
      ],
    },
    {
      heading: "6. Fees",
      paragraphs: [
        "After the trial, fees are as agreed in your plan and exclude GST. Unpaid fees may lead to access being paused.",
      ],
    },
    {
      heading: "7. Suspension and closing an account",
      paragraphs: [
        "We may pause access for non-payment, misuse, or to protect the service or others. You may close your company's account at any time. On closure you may export your data for 30 days; after that we delete it, except what the law requires us to keep.",
      ],
    },
    {
      heading: "8. Availability and support",
      paragraphs: [
        "We work to keep the service available but do not promise uninterrupted operation. Support is available at " + CONTROLLER.email + ".",
      ],
    },
    {
      heading: "9. Intellectual property",
      paragraphs: [
        `${CONTROLLER.name} owns ${CONTROLLER.product} and its software. Your company owns the data it enters.`,
      ],
    },
    {
      heading: "10. Liability",
      paragraphs: [
        "The service is provided as is. To the extent the law allows, Flowacord is not liable for indirect or consequential loss, and its total liability is limited to the fees your company paid in the 12 months before the claim.",
      ],
    },
    {
      heading: "11. Changes and governing law",
      paragraphs: [
        "We may update these terms; a new version is shown before it applies and must be accepted to continue. These terms are governed by the laws of India, and courts in India have jurisdiction.",
      ],
    },
    GRIEVANCE_SECTION,
  ],
  purposes: [],
};

const PRIVACY_V1: ConsentDocument = {
  key: "privacy",
  version: 1,
  language: "en",
  title: "FlowHRMS Privacy Policy",
  summary: `How ${CONTROLLER.name} handles personal data in ${CONTROLLER.product}, under the Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025.`,
  sections: [
    {
      heading: "1. Our role",
      paragraphs: [
        `For people who register a company or hold a FlowHRMS account in their own right, ${CONTROLLER.name} is the Data Fiduciary. For employees whose work records a company keeps in FlowHRMS, that company is the Data Fiduciary and ${CONTROLLER.name} is its Data Processor.`,
      ],
    },
    {
      heading: "2. What we collect",
      items: [
        "Account holders: name, email, mobile number, role, company details, and how you heard about us.",
        "Employees of our customers: the work records described in the employee notice — contact details, attendance times, location only at check-in and check-out, leave, tasks and photos, salary and payslips, and documents.",
        "Everyone who signs in: IP address, device and browser details, and sign-in times, for security.",
        "Consent records: what notice was shown, what was agreed, when, and from which IP address and device.",
      ],
    },
    {
      heading: "3. Why, and on what basis",
      paragraphs: [
        "We process personal data to provide and secure FlowHRMS, to support customers, and to meet legal obligations. We rely on consent given through our notices, and on the legitimate uses the Act permits (including employment purposes, where our customer relies on them). We ask separately for optional purposes such as product updates.",
      ],
    },
    {
      heading: "4. Location",
      paragraphs: [
        "FlowHRMS captures an employee's location only at the moment they check in or check out, to confirm a permitted place of work. It does not track location continuously or in the background.",
      ],
    },
    {
      heading: "5. Sharing and storage",
      paragraphs: [
        "We do not sell personal data or use it for advertising. Service providers who host and operate FlowHRMS for us process it under contract. Data may be processed outside India by these providers where the law permits. We disclose data to authorities only where the law requires it.",
      ],
    },
    {
      heading: "6. Security",
      paragraphs: [
        "We use encryption in transit, access controls that keep each company's data separate, least-privilege access for our staff, and logging of security-relevant events. Invitation links and similar tokens are stored only as hashes. We will notify affected people and the Data Protection Board of a personal data breach as the law requires.",
      ],
    },
    {
      heading: "7. Retention",
      paragraphs: [
        "Account data is kept while the account is open and erased or anonymised within 90 days of closure, except what the law requires us to keep. Records of consent are kept for as long as we may need to show that consent was obtained. Security logs are kept for at least one year.",
      ],
    },
    {
      heading: "8. Cookies",
      paragraphs: [
        "We use only the cookies needed to keep you signed in and to protect the service. We do not use advertising or tracking cookies.",
      ],
    },
    {
      heading: "9. Children",
      paragraphs: [
        "FlowHRMS is not intended for anyone under 18. Customers must not add a person under 18 without verifiable consent of a parent or lawful guardian.",
      ],
    },
    RIGHTS_SECTION,
    {
      heading: "10. Changes",
      paragraphs: [
        "When this policy or a notice changes in a way that affects consent, we publish a new version and ask for consent again before it applies.",
      ],
    },
    GRIEVANCE_SECTION,
  ],
  purposes: [],
};

/**
 * 29 Sept 2026: the company terms, Terms of Service and Privacy Policy say
 * that location is also captured at field-visit taps where a company uses
 * field visits (FIELD-VISITS-MODULE.md §9).
 */
const CUSTOMER_TERMS_V2: ConsentDocument = {
  ...CUSTOMER_TERMS_V1,
  version: 2,
  sections: CUSTOMER_TERMS_V1.sections.map((section) =>
    section.paragraphs
      ? {
          ...section,
          paragraphs: section.paragraphs.map((p) =>
            p.replace(
              "location at the moment of check-in and check-out,",
              "location at the moment of check-in and check-out (and at each field-visit tap, if your company uses field visits),",
            ),
          ),
        }
      : section,
  ),
};

const TERMS_V2: ConsentDocument = {
  ...TERMS_V1,
  version: 2,
  sections: TERMS_V1.sections.map((section) =>
    section.paragraphs
      ? {
          ...section,
          paragraphs: section.paragraphs.map((p) =>
            p.replace(
              "(including location at check-in and check-out)",
              "(including location at check-in and check-out, and at field-visit taps where a company uses field visits)",
            ),
          ),
        }
      : section,
  ),
};

const PRIVACY_V2: ConsentDocument = {
  ...PRIVACY_V1,
  version: 2,
  sections: PRIVACY_V1.sections.map((section) => {
    if (section.heading === "2. What we collect" && section.items) {
      return {
        ...section,
        items: section.items.map((item) =>
          item.replace(
            "location only at check-in and check-out,",
            "location only at check-in and check-out (and at field-visit taps where their company uses field visits), field visits,",
          ),
        ),
      };
    }
    if (section.heading === "4. Location") {
      return {
        ...section,
        paragraphs: [
          "FlowHRMS captures an employee's location only at the moment they check in or check out, to confirm a permitted place of work, and — where their company uses field visits — at the moment they tap Going out, Reached, End visit or Back at office, to record where they went and the road distance travelled. Employees may refuse location at visit taps; their visits are then recorded without it. FlowHRMS does not track location continuously, between taps, or in the background.",
        ],
      };
    }
    return section;
  }),
};

/** The current version of every document. Append new versions; never edit. */
export const CURRENT_DOCUMENTS: Record<DocumentKey, ConsentDocument> = {
  account_holder: ACCOUNT_HOLDER_V1,
  customer_terms: CUSTOMER_TERMS_V2,
  employee: EMPLOYEE_V3,
  terms: TERMS_V2,
  privacy: PRIVACY_V2,
};

/**
 * The exact bytes that are hashed and stored. Key order is fixed by
 * construction, so the same document always serialises the same way.
 */
export function canonicalBody(doc: ConsentDocument): string {
  return JSON.stringify({
    key: doc.key,
    version: doc.version,
    language: doc.language,
    title: doc.title,
    summary: doc.summary,
    sections: doc.sections,
    purposes: doc.purposes,
  });
}

export function parseBody(body: string): ConsentDocument {
  return JSON.parse(body) as ConsentDocument;
}
