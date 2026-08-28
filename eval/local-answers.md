# Local answers

Run 2026-08-28 against `onnx-community/Qwen2.5-0.5B-Instruct`.

The passage is handed to the model rather than retrieved, so a wrong answer
here is the model's and not the floor's. `grounded` is a substring check
against expected spellings of the fact — a floor, not a grade: it cannot tell
a value from a negated one. The answers are printed because the failure on
record is a shape, a marker standing where a number belongs, and a regex for
that would measure the regex.

**4/8 grounded, 0/8 cited.**

| question | grounded | cited |
| -------- | -------- | ----- |
| How quickly does someone get back to me if everything is down? | yes | **no** |
| How long do you keep whatever I attach to a ticket? | yes | **no** |
| How much warning do I need to give before it renews? | **no** | **no** |
| What do I get back if you miss a target? | **no** | **no** |
| The boiler died in January. How fast should someone come? | **no** | **no** |
| How much notice do I give to move out? | **no** | **no** |
| How much do I have to hand over at the start? | yes | **no** |
| What hours is the standard plan covered? | yes | **no** |

## Answers

**How quickly does someone get back to me if everything is down?**

> 30 minutes for Severity 1, two hours for Severity 2, one business day for Severity 3, and three business days for Severity 4.

**How long do you keep whatever I attach to a ticket?**

> 90 days.

**How much warning do I need to give before it renews?**

> The warning period for cancellation does not specify a clear amount of time, but it generally starts immediately upon notification. Therefore, there is no specific number of days mentioned in the passage.

**What do I get back if you miss a target?**

> If you miss a target, you will receive credit for that missed target up to 25% of the total cost per calendar month.

**The boiler died in January. How fast should someone come?**

> emergency repairs are attended within 24 days.

**How much notice do I give to move out?**

> The notice period is specified in the agreement between the landlord and tenant.

**How much do I have to hand over at the start?**

> To determine how much you need to hand over at the start, we need to refer to the information provided in the passage. According to the passage, the deposit amount is stated as follows:
> 
> "The deposit is five weeks' rent and is registered with an approved protection scheme within 30 days of receipt."
> 
> This indicates that the deposit amount is calculated based on the value of the rent plus the duration (in this case, five weeks) multiplied by the number of days available for registration (30 days).
> 
> Therefore, the deposit amount you need to hand over at the start is **five weeks' worth of rent**.

**What hours is the standard plan covered?**

> 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country.

