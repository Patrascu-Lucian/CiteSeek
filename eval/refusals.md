# What the model does with the questions the floor lets through

Three sets of unanswerable questions. The golden set's are the ones its floor
table counts. Each uncovered question names something one document is about
and asks for a detail it does not cover, so that set samples the hard region
on purpose and its rate is not the product's. The adjacent set has the same
shape, asked of the demo handbook alone, as a guest's workspace holds it.

| set | clear the shipped floor | carrying a marker | rendered as a link | unlinked by its form | carrying an out-of-range marker |
| --- | ----------------------- | ----------------- | ------------------ | -------------------- | ------------------------------- |
| golden | 5 of 10 | 4, 3, 3 of 5 | 0, 0, 0 of 5 | 4, 3, 3 of 5 | 0, 0, 0 of 5 |
| uncovered | 15 of 15 | 12, 10, 11 of 15 | 0, 0, 0 of 15 | 12, 10, 11 of 15 | 0, 0, 0 of 15 |
| adjacent | 10 of 10 | 9, 9, 8 of 10 | 0, 0, 0 of 10 | 9, 9, 8 of 10 | 0, 0, 0 of 10 |

Per run, every column reading markers as the page does. A reply that opens
in a declining form the page recognizes links none of its markers (ADR 058),
so "rendered as a link" is what a reader can still click on a refusal:
replies that declined in a wording the page does not recognize. Whether an
unlinked marker pointed at something relevant is read from the answers
below, not counted here.

The last column is the one that does not read as the page does: a marker
naming no passage the reply was given, counted on every reply whatever its
form. The page folds one in a declining reply into that reply's single
note, so its own reading would show none.

Rule 4 of the system prompt forbids attaching a marker to a refusal, so a
marker on a refusal is the prompt broken by its own definition. Answers are
verbatim, because whether a reply refused at all is read rather than
matched: a regex over refusal wording would measure the regex. The model
runs with the chat route's tools and step limit.

## Run 1 — golden — What is the warranty period on the hydraulic pump?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover the warranty period on the hydraulic pump; they mention that defeating the guard interlock voids the warranty [7], but they do not specify how long the warranty lasts or provide warranty terms for specific components.

## Run 1 — golden — Is there parking included?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover parking. They do cover tenancy agreement terms regarding subletting, guests, and pets [1][2].

## Run 1 — golden — What are the fire evacuation arrangements?

Cited: false
Linked on the page: false
Passages: 1
Out of range: none

The documents do not cover fire evacuation arrangements; they cover maintenance responsibilities, repair timeframes, emergency repair procedures, and access.

## Run 1 — golden — How many people work in the support team?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, credits, data handling, and ending a support plan [1][2][3][4][5][6][7][8].

## Run 1 — golden — Does the press come in a wider bed size?

Cited: true
Linked on the page: false
Passages: 6
Out of range: none

The documents do not cover whether the press comes in a wider bed size; they cover the operating manual, safety, hydraulic oil, storage and transport, die changes, and fault codes for the Harbourline HL-90 Bench Press [1][2][3][4][5][6].

## Run 1 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover resolution targets for Severity 1 tickets; they only cover first response targets (30 minutes) [1] and mention that resolution targets are not contractual for Severity 3 and 4 [1].

## Run 1 — uncovered — How much does a Premier plan cost each month?

Cited: true
Linked on the page: false
Passages: 4
Out of range: none

The documents do not cover the monthly cost of a Premier plan; they only discuss response targets, credit percentages, coverage hours, and renewal policies for the plans [1][2][3].

## Run 1 — uncovered — What is the phone number for the duty lead?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover the phone number for the duty lead; they cover ticket escalation rules, ownership of escalated tickets by the duty lead, and how severity levels are handled [1][2].

## Run 1 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term (they only specify that downgrading from Premier to Standard takes effect at renewal and never mid-term) [1].

## Run 1 — uncovered — In which languages do support engineers answer tickets?

Cited: false
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover the languages in which support engineers answer tickets; they cover support plans, response and resolution targets, coverage hours, escalation, credits, data handling during support, and ending a support plan.

## Run 1 — uncovered — What does fault code E03 indicate?

Cited: false
Linked on the page: false
Passages: 5
Out of range: none

The documents do not cover fault code E03. They do cover other fault codes such as E01 (low oil level), E02 (guard interlock is open), E04 (over-temperature), and E07 (pressure sensor disagreement).

## Run 1 — uncovered — What voltage does the press need?

Cited: true
Linked on the page: false
Passages: 7
Out of range: none

The documents do not cover the voltage requirements for the press; they cover safety, hydraulic oil, storage and transport, die changes, fault codes, and daily checks for the Harbourline HL-90 Bench Press [1][2][3][4][5][6][7].

## Run 1 — uncovered — How much does the press weigh?

Cited: true
Linked on the page: false
Passages: 7
Out of range: none

The documents do not cover the weight of the press; they cover its operating force (90 kilonewtons), noise level (84 dB at one metre), oil temperature limits, and other operating and maintenance specifications [1][4].

## Run 1 — uncovered — How often should the pressure sensors be calibrated?

Cited: true
Linked on the page: false
Passages: 6
Out of range: none

The documents do not cover the calibration frequency for pressure sensors; they cover daily checks [2], hydraulic oil requirements and replacement intervals [4], die change procedures [5][6], fault codes [1][6], storage and transport [1], and precautions for depressurizing the hydraulic system [3].

## Run 1 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover which specific corrosion inhibitor is approved; they only state that the exposed rod should be coated in a corrosion inhibitor for storage over three months [1].

## Run 1 — uncovered — What is the late payment fee for rent?

Cited: true
Linked on the page: false
Passages: 6
Out of range: none

The documents do not cover late payment fees for rent; they cover rent payment methods, rent review terms, deposit rules, repairs, landlord access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6].

## Run 1 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true
Linked on the page: false
Passages: 7
Out of range: none

The documents do not cover council tax; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6][7].

## Run 1 — uncovered — Is smoking allowed in the property?

Cited: false
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover whether smoking is allowed in the property; they only cover pets, subletting, and guests.

## Run 1 — uncovered — Who is responsible for maintaining the garden?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover who is responsible for maintaining the garden; they cover repairs and maintenance responsibilities such as the structure, exterior, installations for water, gas, electricity, and sanitation, the heating system, internal decoration, replacing light bulbs and smoke alarm batteries, and keeping drains and gutters accessible [1][2].

## Run 1 — uncovered — Is the property let furnished?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover whether the property is let furnished; they cover rent reviews, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1], [2], [3], [4], [5], [6], [7], [8].

## Run 1 — adjacent — What is the warranty on the company laptop?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover a warranty on company laptops; they state that equipment failing within the three-year period is replaced rather than repaired [3].

## Run 1 — adjacent — How much notice do I need to give for unpaid leave?

Cited: true
Linked on the page: false
Passages: 3
Out of range: none

The documents do not cover unpaid leave; they cover annual leave, sick leave, public holidays, travel, and data handling [1][2][3].

## Run 1 — adjacent — Does the company pay toward home internet costs?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover home internet costs; they cover equipment such as laptops, external monitors, and desk chairs [1], as well as peripherals, software licenses, and co-working space expenses [2][3].

## Run 1 — adjacent — What is the mileage rate for driving to a company office?

Cited: true
Linked on the page: false
Passages: 7
Out of range: none

The documents do not cover the mileage rate for driving to a company office; they cover travel booking through the travel desk, expense reimbursement rules, default rail journeys, flight and hotel caps, and travel time during working hours [1][2].

## Run 1 — adjacent — How many days of paternity leave do employees get?

Cited: false
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover paternity leave; they cover remote work policies including time off (annual leave and sick leave), public holidays, and travel.

## Run 1 — adjacent — Which laptop brand is issued to remote employees?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover which laptop brand is issued to remote employees; they only state that every remote employee receives a laptop and may choose between a 14-inch and a 16-inch model [2].

## Run 1 — adjacent — What is the daily meal allowance when travelling?

Cited: true
Linked on the page: false
Passages: 4
Out of range: none

The documents do not cover the daily meal allowance when travelling; they cover travel booking methods, hotel caps, flight and rail rules, and travel time compensation [1][2].

## Run 1 — adjacent — Is unused annual leave paid out when I leave the company?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover whether unused annual leave is paid out when leaving the company; they only state that annual leave is 28 days plus public holidays and that unused leave does not carry over [1].

## Run 1 — adjacent — How many sick days can I take in a year?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover the total number of sick days you can take in a year; they only state that sick leave is not counted against annual leave and does not require a medical certificate for absences of seven days or fewer [1].

## Run 1 — adjacent — Can I open company documents on public Wi-Fi?

Cited: true
Linked on the page: false
Passages: 4
Out of range: none

The documents do not cover whether company documents can be opened on public Wi-Fi. They do cover data handling, stating that company documents may not be uploaded to unapproved third-party services, and that restricted documents may not leave company-managed devices at all [2][3].

## Run 2 — golden — What is the warranty period on the hydraulic pump?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover the warranty period on the hydraulic pump; they mention that the press develops 90 kilonewtons, require hearing protection within two metres during operation, and detail operating instructions, hydraulic oil specifications, daily checks, die changes, fault codes, storage, and transport [1][2][3][4][5][6][7].

## Run 2 — golden — Is there parking included?

Cited: false
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover parking.

## Run 2 — golden — What are the fire evacuation arrangements?

Cited: false
Linked on the page: false
Passages: 1
Out of range: none

The documents do not cover fire evacuation arrangements; they cover repair times, emergency repair definitions, tenant-arranged emergency repairs, and property maintenance responsibilities such as replacing light bulbs and smoke alarm batteries.

## Run 2 — golden — How many people work in the support team?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation, credits, data handling during support, and ending a support plan [1][2][3][4][5][6][7][8].

## Run 2 — golden — Does the press come in a wider bed size?

Cited: true
Linked on the page: false
Passages: 6
Out of range: none

The documents do not cover whether the press comes in a wider bed size; they cover the operating manual, safety, hydraulic oil, storage and transport, fault codes, die changes, and daily checks for the Harbourline HL-90 Bench Press [1][2][3][4][5][6].

## Run 2 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover resolution targets for Severity 1 tickets; they only cover first response targets (which are 30 minutes for Severity 1) [1] and mention that resolution targets are not contractual for Severity 3 and 4 [1].

## Run 2 — uncovered — How much does a Premier plan cost each month?

Cited: true
Linked on the page: false
Passages: 4
Out of range: none

The documents do not cover the monthly cost of a Premier plan; they only cover service credits for missed response targets [1], coverage hours [3], and renewal and downgrade terms [2].

## Run 2 — uncovered — What is the phone number for the duty lead?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover the phone number for the duty lead; they only cover how escalation moves the ticket to the duty lead, who owns it until closure and may not reassign it back to the original queue [1][2].

## Run 2 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term. They do cover downgrading from Premier to Standard, which takes effect at renewal and never mid-term [1].

## Run 2 — uncovered — In which languages do support engineers answer tickets?

Cited: false
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover the languages in which support engineers answer tickets; they cover support plans, coverage hours, response and resolution targets, escalation procedures, service credits, data handling during support, and plan renewals.

## Run 2 — uncovered — What does fault code E03 indicate?

Cited: true
Linked on the page: false
Passages: 5
Out of range: none

The documents do not cover fault code E03. They do cover other fault codes, such as E01 (low oil level), E02 (guard interlock open), E04 (over-temperature), and E07 (pressure sensor disagreement) [1][2].

## Run 2 — uncovered — What voltage does the press need?

Cited: false
Linked on the page: false
Passages: 7
Out of range: none

The documents do not cover the electrical voltage required by the press; they cover safety, operating instructions, hydraulic oil specifications, die changes, fault codes, and daily checks.

## Run 2 — uncovered — How much does the press weigh?

Cited: false
Linked on the page: false
Passages: 7
Out of range: none

The documents do not cover the weight of the press; they cover its operating manual, safety guidelines, hydraulic oil specifications, die changes, daily checks, and fault codes.

## Run 2 — uncovered — How often should the pressure sensors be calibrated?

Cited: true
Linked on the page: false
Passages: 6
Out of range: none

The documents do not cover how often pressure sensors should be calibrated, though they do mention that fault code E07 indicates a pressure sensor disagreement where the two sensors differ by more than 5 bar [1].

## Run 2 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover which specific corrosion inhibitor is approved; they only state that for storage over three months, the exposed rod should be coated in a corrosion inhibitor [1].

## Run 2 — uncovered — What is the late payment fee for rent?

Cited: true
Linked on the page: false
Passages: 6
Out of range: none

The documents do not cover late payment fees for rent; they cover rent payment methods (monthly in advance by standing order), rent reviews, and the return of unallocated transfers [1][2].

## Run 2 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true
Linked on the page: false
Passages: 7
Out of range: none

The documents do not cover council tax; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6][7].

## Run 2 — uncovered — Is smoking allowed in the property?

Cited: false
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover whether smoking is allowed in the property; they only cover pets, subletting, guests, and tenancy notifications.

## Run 2 — uncovered — Who is responsible for maintaining the garden?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover who is responsible for maintaining the garden; they cover repair responsibilities such as the structure, exterior, installations, heating system, internal decoration, light bulbs, smoke alarm batteries, and drains and gutters [1][2].

## Run 2 — uncovered — Is the property let furnished?

Cited: false
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover whether the property is let furnished; they cover rent reviews, deposits, repairs, access, ending the tenancy, subletting, guests, and pets.

## Run 2 — adjacent — What is the warranty on the company laptop?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not mention a warranty on the company laptop, but they state that equipment failing within the three-year period is replaced rather than repaired [3].

## Run 2 — adjacent — How much notice do I need to give for unpaid leave?

Cited: true
Linked on the page: false
Passages: 3
Out of range: none

The documents do not cover unpaid leave; they cover annual leave, sick leave, public holidays, travel, and data handling [1][2][3].

## Run 2 — adjacent — Does the company pay toward home internet costs?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover home internet costs; they cover equipment, software licenses, co-working space expenses, travel, and time off [3][4][5].

## Run 2 — adjacent — What is the mileage rate for driving to a company office?

Cited: true
Linked on the page: false
Passages: 7
Out of range: none

The documents do not cover the mileage rate for driving to a company office; they cover travel booking through the travel desk, expense claims, rail and flight rules, hotel caps, and travel time [1][2].

## Run 2 — adjacent — How many days of paternity leave do employees get?

Cited: false
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover paternity leave; they cover remote work policies including time off (such as annual leave and sick leave) and travel.

## Run 2 — adjacent — Which laptop brand is issued to remote employees?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover which laptop brand is issued to remote employees; they only state that every remote employee receives a laptop and may choose between a 14-inch and a 16-inch model [2].

## Run 2 — adjacent — What is the daily meal allowance when travelling?

Cited: true
Linked on the page: false
Passages: 4
Out of range: none

The documents do not cover the daily meal allowance when travelling; they cover travel booking methods, rail and flight rules, hotel price caps, and expense reimbursement guidelines such as receipt requirements and payroll schedules [1][2][3].

## Run 2 — adjacent — Is unused annual leave paid out when I leave the company?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover whether unused annual leave is paid out when leaving the company; they only state that annual leave is 28 days plus public holidays and that unused leave does not carry over [1].

## Run 2 — adjacent — How many sick days can I take in a year?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover the total number of sick days you can take in a year. They do state that sick leave is not counted against annual leave and does not require a medical certificate for absences of seven days or fewer [1].

## Run 2 — adjacent — Can I open company documents on public Wi-Fi?

Cited: true
Linked on the page: false
Passages: 4
Out of range: none

The documents do not cover whether company documents can be opened on public Wi-Fi. They do cover data handling, including restrictions on uploading company documents to unapproved third-party services, rules for personal accounts, and handling of restricted documents [1][2][3].

## Run 3 — golden — What is the warranty period on the hydraulic pump?

Cited: false
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover the warranty period on the hydraulic pump; they mention that the press develops 90 kilonewtons, require hearing protection, and detail safety rules, oil specifications, daily checks, die changes, fault codes, storage, and support policies.

## Run 3 — golden — Is there parking included?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover whether parking is included; they cover pets, subletting, and guests [1][2].

## Run 3 — golden — What are the fire evacuation arrangements?

Cited: false
Linked on the page: false
Passages: 1
Out of range: none

The documents do not cover fire evacuation arrangements; they cover repair responsibilities, emergency and non-emergency repair timeframes, tenant-arranged emergency repairs, and property access.

## Run 3 — golden — How many people work in the support team?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover how many people work in the support team; they cover support plans, response and resolution targets, coverage hours, escalation rules, credits, data handling during support, and ending a support plan [1][2][3][4][5][6][7][8].

## Run 3 — golden — Does the press come in a wider bed size?

Cited: true
Linked on the page: false
Passages: 6
Out of range: none

The documents do not cover bed sizes for the press; they cover safety, hydraulic oil specifications, storage and transport, fault codes, die changes, and daily checks [1][2][3][4][5][6].

## Run 3 — uncovered — What is the resolution target for a Severity 1 ticket?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover the resolution target for a Severity 1 ticket; they cover first response targets (30 minutes for Severity 1) and resolution targets for lower severities (which are deliberately not contractual for Severity 3 and 4) [1][4].

## Run 3 — uncovered — How much does a Premier plan cost each month?

Cited: true
Linked on the page: false
Passages: 4
Out of range: none

The documents do not cover the monthly cost of a Premier plan; they only cover service credits for missed response targets [1], coverage hours [3], and plan renewal and downgrading rules [2].

## Run 3 — uncovered — What is the phone number for the duty lead?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover the phone number for the duty lead; they cover ticket escalation rules, ownership of escalated tickets, and how severity levels are handled [1][2].

## Run 3 — uncovered — Can a Standard plan be upgraded to Premier mid-term?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover whether a Standard plan can be upgraded to Premier mid-term; they only state that downgrading from Premier to Standard takes effect at renewal and never mid-term [1].

## Run 3 — uncovered — In which languages do support engineers answer tickets?

Cited: false
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover the languages in which support engineers answer tickets; they cover support plans, coverage hours, response and resolution targets, escalation procedures, service credits, data handling during support, and plan renewals.

## Run 3 — uncovered — What does fault code E03 indicate?

Cited: false
Linked on the page: false
Passages: 5
Out of range: none

The documents do not cover fault code E03. They do cover other fault codes such as E01 (low oil level), E02 (guard interlock is open), E04 (over-temperature), and E07 (pressure sensor disagreement).

## Run 3 — uncovered — What voltage does the press need?

Cited: false
Linked on the page: false
Passages: 7
Out of range: none

The documents do not cover the voltage requirements for the press; they cover safety, operating instructions, hydraulic oil maintenance, die changes, fault codes, daily checks, and storage and transport.

## Run 3 — uncovered — How much does the press weigh?

Cited: true
Linked on the page: false
Passages: 7
Out of range: none

The documents do not cover the weight of the press; they cover its operating force (90 kilonewtons), noise level (84 dB at one metre), oil temperature limits, and other operating and maintenance specifications [1][4].

## Run 3 — uncovered — How often should the pressure sensors be calibrated?

Cited: true
Linked on the page: false
Passages: 6
Out of range: none

The documents do not cover the calibration frequency for pressure sensors; they cover daily checks [2], hydraulic oil specifications and change intervals [4], die change procedures [5], and fault codes such as E07 for pressure sensor disagreement [1].

## Run 3 — uncovered — Which corrosion inhibitor is approved for the exposed rod?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover which specific corrosion inhibitor is approved; they only state that for storage over three months, the exposed rod should be coated in a corrosion inhibitor [1].

## Run 3 — uncovered — What is the late payment fee for rent?

Cited: true
Linked on the page: false
Passages: 6
Out of range: none

The documents do not cover late payment fees for rent; they cover rent payment methods, review frequency, caps, and notice requirements [1][2].

## Run 3 — uncovered — Is the tenant or the landlord responsible for council tax?

Cited: true
Linked on the page: false
Passages: 7
Out of range: none

The documents do not cover council tax; they cover rent, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1][2][3][4][5][6][7].

## Run 3 — uncovered — Is smoking allowed in the property?

Cited: false
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover whether smoking is allowed in the property; they only cover pets, subletting, guests, and tenancy notifications.

## Run 3 — uncovered — Who is responsible for maintaining the garden?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover who is responsible for maintaining the garden; they cover landlord and tenant repair responsibilities (such as structure, exterior, installations, internal decoration, light bulbs, smoke alarm batteries, and drains and gutters), emergency and non-emergency repair timeframes, repair costs, and tenancy deposit dispute procedures [1][2].

## Run 3 — uncovered — Is the property let furnished?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover whether the property is let furnished; they cover rent reviews, deposits, repairs, access, ending the tenancy, subletting, guests, and pets [1], [2], [3], [4], [5], [6], [7], [8].

## Run 3 — adjacent — What is the warranty on the company laptop?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not mention a warranty on company laptops; they state that equipment failing within the three-year period is replaced rather than repaired [3].

## Run 3 — adjacent — How much notice do I need to give for unpaid leave?

Cited: true
Linked on the page: false
Passages: 3
Out of range: none

The documents do not cover unpaid leave; they cover annual leave, sick leave, public holidays, travel rules, and data handling [1][2][3].

## Run 3 — adjacent — Does the company pay toward home internet costs?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover home internet costs; they cover equipment such as a laptop, external monitor, and desk chair, as well as expenses for software licenses, co-working space, and peripherals beyond the standard set [1][2][3].

## Run 3 — adjacent — What is the mileage rate for driving to a company office?

Cited: false
Linked on the page: false
Passages: 7
Out of range: none

The documents do not cover mileage rates for driving to a company office; they cover travel bookings, rail defaults, flight classes, and hotel caps.

## Run 3 — adjacent — How many days of paternity leave do employees get?

Cited: false
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover paternity leave; they cover remote work policies including annual leave, sick leave, public holidays, and travel.

## Run 3 — adjacent — Which laptop brand is issued to remote employees?

Cited: true
Linked on the page: false
Passages: 8
Out of range: none

The documents do not cover which laptop brand is issued to remote employees; they only mention that every remote employee receives a laptop and can choose between a 14-inch and a 16-inch model [2].

## Run 3 — adjacent — What is the daily meal allowance when travelling?

Cited: true
Linked on the page: false
Passages: 4
Out of range: none

The documents do not cover the daily meal allowance when travelling; they cover travel booking methods, transportation choices, expense reimbursement rules, receipt requirements, and hotel and flight caps [1][2][3].

## Run 3 — adjacent — Is unused annual leave paid out when I leave the company?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover whether unused annual leave is paid out when leaving the company; they only cover that annual leave is 28 days plus public holidays and unused leave does not carry over [1].

## Run 3 — adjacent — How many sick days can I take in a year?

Cited: true
Linked on the page: false
Passages: 2
Out of range: none

The documents do not cover the total number of sick days you can take in a year. They do mention that sick leave is not counted against annual leave and does not require a medical certificate for absences of seven days or fewer [1].

## Run 3 — adjacent — Can I open company documents on public Wi-Fi?

Cited: true
Linked on the page: false
Passages: 4
Out of range: none

The documents do not cover whether company documents can be opened on public Wi-Fi. They do cover data handling, stating that company documents may not be uploaded to third-party services that have not been approved by the security team, and that documents classified as restricted may not leave company-managed devices at all [2][3].
