# Local answers

Run 2026-08-28 against `onnx-community/Qwen2.5-0.5B-Instruct`.

Each question is asked twice: with the answering passage alone, and with the
8 the local embedder ranks highest — which is what a reader gets. The
first column is a ceiling, the second is the product.

`grounded` is a substring check against expected spellings of the fact, on a
digit boundary. A floor, not a grade: it cannot tell a value from a negated
one. The answers are printed because the failure on record is a shape — a
marker standing where a number belongs — and a regex for that would measure
the regex.

**Grounded 4/8 on the passage alone, 2/8 on 8. Cited 0/8.**

| question | alone | 8 passages | retrieved |
| -------- | ----- | ----------- | --------- |
| How quickly does someone get back to me if everything is down? | yes | yes | yes |
| How long do you keep whatever I attach to a ticket? | yes | **no** | yes |
| How much warning do I need to give before it renews? | **no** | **no** | yes |
| What do I get back if you miss a target? | **no** | **no** | yes |
| The boiler died in January. How fast should someone come? | **no** | **no** | yes |
| How much notice do I give to move out? | **no** | **no** | yes |
| How much do I have to hand over at the start? | yes | **no** | yes |
| What hours is the standard plan covered? | yes | yes | yes |

## Answers

**How quickly does someone get back to me if everything is down?**

Passage alone:

> 30 minutes for Severity 1, two hours for Severity 2, one business day for Severity 3, and three business days for Severity 4.

With 8:

> According to the Meridian Software Customer Support Policy, customers receive a standard response time of 30 minutes from ticket creation to the duty engineer.

**How long do you keep whatever I attach to a ticket?**

Passage alone:

> 90 days.

With 8:

> The ticket system runs to resolution under the plan in force when they were raised.

**How much warning do I need to give before it renews?**

Passage alone:

> The warning period for cancellation does not specify a clear amount of time, but it generally starts immediately upon notification. Therefore, there is no specific number of days mentioned in the passage.

With 8:

> Two months

**What do I get back if you miss a target?**

Passage alone:

> If you miss a target, you will receive credit for that missed target up to 25% of the total cost per calendar month.

With 8:

> If you miss a target, you receive a defect with a workaround.

**The boiler died in January. How fast should someone come?**

Passage alone:

> emergency repairs are attended within 24 days.

With 8:

> According to the information provided, the correct answer is:
> 1 month

**How much notice do I give to move out?**

Passage alone:

> The notice period is specified in the agreement between the landlord and tenant.

With 8:

> To determine how much notice you should give to move out, refer to the following information:
> - Notice must be in writing.
> - A notice served by message or spoken in person has no effect, which protects both parties from a disagreement about what was said.
> 
> Therefore, based on these guidelines, you should provide at least one month's notice to move out.

**How much do I have to hand over at the start?**

Passage alone:

> To determine how much you need to hand over at the start, we need to refer to the information provided in the passage. According to the passage, the deposit amount is stated as follows:
> 
> "The deposit is five weeks' rent and is registered with an approved protection scheme within 30 days of receipt."
> 
> This indicates that the deposit amount is calculated based on the value of the rent plus the duration (in this case, five weeks) multiplied by the number of days available for registration (30 days).
> 
> Therefore, the deposit amount you need to hand over at the start is **five weeks' worth of rent**.

With 8:

> To determine how much you need to hand over at the start, we need to refer to the relevant section of the property agreement. According to the information provided, the starting amount typically includes the rent charge and any other charges specified in the agreement. However, there might also be additional fees or deposits mentioned elsewhere in the document. Without access to the full agreement, we can't provide a precise figure. If you're looking for the total amount at the start, you should consult the specific section detailing the initial payment requirements.

**What hours is the standard plan covered?**

Passage alone:

> 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country.

With 8:

> The standard plan is covered from 09:00 to 18:00 in the customer's registered timezone.

