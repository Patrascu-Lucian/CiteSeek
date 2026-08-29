# Local answers

Run 2026-08-29 against `onnx-community/Qwen2.5-0.5B-Instruct`.

Local mode end to end: the local embedder ranks the passages, the local model
answers from them. `oracle` hands the answering passage over instead, so it is
the ceiling retrieval cannot beat.

Both halves at every count, because they move in opposite directions — fewer
passages read better and retrieve worse. `--sweep` re-opens the counts below
the shipping one; the answer there is that grounding is flat.

`grounded` is a substring check on a digit boundary. A floor, not a grade: it
cannot tell a value from a negated one.

| passages | grounded | cited | answer retrieved |
| -------- | -------- | ----- | ---------------- |
| 8 | 2/8 | 0/8 | 8/8 |
| oracle | 4/8 | 0/8 | by construction |

## Per question

| question | 8 | oracle |
| -------- | - | ------ |
| How quickly does someone get back to me if everything is down? | yes | yes |
| How long do you keep whatever I attach to a ticket? | **no** | yes |
| How much warning do I need to give before it renews? | **no** | **no** |
| What do I get back if you miss a target? | **no** | **no** |
| The boiler died in January. How fast should someone come? | **no** | **no** |
| How much notice do I give to move out? | **no** | **no** |
| How much do I have to hand over at the start? | **no** | yes |
| What hours is the standard plan covered? | yes | yes |

`_missed_` is retrieval not returning the answering passage at that count;
**no** is the model having it and not using it.

## Answers, on the oracle passage

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

