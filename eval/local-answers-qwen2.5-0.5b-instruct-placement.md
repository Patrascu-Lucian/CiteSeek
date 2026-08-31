# Local answers

Run 2026-08-31 against `onnx-community/Qwen2.5-0.5B-Instruct` at `q4`.

**Not the shipped prompt.** Added: a placement line (not quoting a specimen).

Local mode end to end: the local embedder ranks the passages, the local model
answers from them. `oracle` hands the answering passage over instead, so it is
the ceiling retrieval cannot beat.

Both halves at every count, because they move in opposite directions — fewer
passages read better and retrieve worse.

The distance floor applies before the count, as `lib/local/retrieve.ts` does
it, so a row's passages are what survived the floor rather than what was asked
for. Without that these numbers could not predict the browser's, which is the
confound recorded in ADR 033.

`grounded` is a substring check on a digit boundary. A floor, not a grade: it
cannot tell a value from a negated one.

`cited` counts a marker in range, not a marker that supports the claim beside
it — a model can score well here by emitting brackets it cannot justify.

| passages asked | actually given | grounded | cited | answer retrieved |
| -------------- | -------------- | -------- | ----- | ---------------- |
| 3 | 2.8 avg | 15/24 | 1/24 | 24/24 |
| oracle | the answering one | 17/24 | 2/24 | by construction |

## Prose questions, on the oracle passage

Whether the zero above is the device or the question. These want prose,
not a value, which is the shape ADR 033 saw markers on — same CPU path.
A refusal is separated because rule 4 forbids citing one.

**Cited 0/8**, refused 0/8.

| question | cited | refused |
| -------- | ----- | ------- |
| How quickly does someone get back to me if everything is down? | **no** | no |
| Does the response clock keep running through the night? | **no** | no |
| Can I push a ticket up the chain more than once? | **no** | no |
| Does pushing a ticket up make it more urgent? | **no** | no |
| What do I get back if you miss a target? | **no** | no |
| Do I have to ask for the money back or is it automatic? | **no** | no |
| Can your engineers ask for a copy of our live database? | **no** | no |
| How long do you keep whatever I attach to a ticket? | **no** | no |

### Prose answers

**How quickly does someone get back to me if everything is down?**

> 30 minutes for Severity 1, two hours for Severity 2, one business day for Severity 3, and three business days for Severity 4.

**Does the response clock keep running through the night?**

> Yes, the response clock does not run during nighttime on standard plans.

**Can I push a ticket up the chain more than once?**

> No, you cannot push a ticket up the chain more than once.

**Does pushing a ticket up make it more urgent?**

> No, pushing a ticket up does not increase its urgency.

**What do I get back if you miss a target?**

> If you miss a target, you will receive credit for that missed target. This credit can be used towards future service costs without requiring payment.

**Do I have to ask for the money back or is it automatic?**

> It depends on the specific situation and circumstances involved.

**Can your engineers ask for a copy of our live database?**

> They are not a refund and cannot be exchanged for one.

**How long do you keep whatever I attach to a ticket?**

> 90 days after closure.

## Per question

| question | 3 | oracle |
| -------- | - | ------ |
| How quickly does someone get back to me if everything is down? | **no** | yes |
| How long do you keep whatever I attach to a ticket? | yes | yes |
| How much warning do I need to give before it renews? | **no** | yes |
| What do I get back if you miss a target? | **no** | **no** |
| The boiler died in January. How fast should someone come? | **no** | **no** |
| How much notice do I give to move out? | yes | yes |
| How much do I have to hand over at the start? | **no** | yes |
| What hours is the standard plan covered? | yes | yes |
| How much force does the press develop? | yes | yes |
| How loud is it at a metre? | yes | yes |
| Which oil grade goes in it? | yes | yes |
| How often does the oil need changing? | yes | **no** |
| What oil temperature is too hot? | yes | yes |
| What torque do the die bolts take? | yes | yes |
| How thin can a die be reground before it is scrap? | yes | yes |
| How far apart can the pressure sensors read before it stops? | yes | yes |
| What humidity needs a desiccant in storage? | yes | **no** |
| How much can the rent go up by? | yes | yes |
| How long does the deposit take to be protected? | **no** | yes |
| How fast is a non-emergency repair attended? | **no** | **no** |
| How long can a guest stay before I have to tell anyone? | **no** | **no** |
| How much is the extra deposit for a pet? | yes | yes |
| How much notice do I give if I am leaving? | **no** | **no** |
| What is the cap on credits in a month? | yes | yes |

`_missed_` is retrieval not returning the answering passage at that count;
**no** is the model having it and not using it.

## Answers, on the oracle passage

**How quickly does someone get back to me if everything is down?**

> 30 minutes for Severity 1, two hours for Severity 2, one business day for Severity 3, and three business days for Severity 4.

**How long do you keep whatever I attach to a ticket?**

> 90 days after closure.

**How much warning do I need to give before it renews?**

> The warning period for cancellation is typically **30 days**. This allows time for any necessary adjustments or changes to be made before the full process begins again.

**What do I get back if you miss a target?**

> If you miss a target, you will receive credit for that missed target. This credit can be used towards future service costs without requiring payment.

**The boiler died in January. How fast should someone come?**

> emergency repairs are attended within 24 days.

**How much notice do I give to move out?**

> Two months

**How much do I have to hand over at the start?**

> To determine how much you need to hand over at the start, we need to refer to the information provided in the first passage. According to the passage, the deposit amount is stated as follows:
> 
> "The deposit is five weeks' rent and is registered with an approved protection scheme within 30 days of receipt."
> 
> This indicates that the deposit amount is calculated based on the rental period (five weeks) and the specific conditions set by the tenant association regarding deposits. Therefore, the deposit amount you should hand over at the start depends on these factors:
> 
> 1. **Rental Period**: Five weeks.
> 2. **Deposit Amount Calculation**: This amount is determined by the specific terms outlined in the agreement between the landlord and tenant.
> 
> Without additional details from the second passage, we cannot provide a numerical value for the deposit amount. However, based on the information given in the first passage, you can calculate the deposit amount yourself using the formula:
> \[ \text{Deposit Amount} = \frac{\text{Deposit Period}}{12} \times \text{Deposit Rate} \]
> Where:
> - Deposit Period = 5 weeks
> - Deposit Rate = 0.05 (assuming the deposit rate is expressed as a percentage)
> 
> Let's calculate the deposit amount now:
> \[ \text{Deposit Amount} = \frac{5}{12} \times 0.05 \approx 0.0375 \]
> 
> So, the deposit amount you should hand over at the start is approximately $0.0375 or 3.75%.
> 
> If you want to know

**What hours is the standard plan covered?**

> 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country.

**How much force does the press develop?**

> 90 kilonewtons

**How loud is it at a metre?**

> 84 dB

**Which oil grade goes in it?**

> ISO VG 46 mineral oil

**How often does the oil need changing?**

> The oil needs changing every [1] operating hours or annually.

**What oil temperature is too hot?**

> Oil temperature above 70°C

**What torque do the die bolts take?**

> 210 Nm

**How thin can a die be reground before it is scrap?**

> 38 mm

**How far apart can the pressure sensors read before it stops?**

> more than 5 bar.

**What humidity needs a desiccant in storage?**

> For storage over three months, [1]

**How much can the rent go up by?**

> The rental amount can increase by up to 4% annually.

**How long does the deposit take to be protected?**

> The deposit is five weeks' rent and is registered with an approved protection scheme within 30 days of receipt.

**How fast is a non-emergency repair attended?**

> a tenant may arrange an emergency repair themselves if the landlord cannot be reached within four hours, and recover the reasonable cost against rent, provided the invoice is produced.

**How long can a guest stay before I have to tell anyone?**

> 14

**How much is the extra deposit for a pet?**

> One week's rent

**How much notice do I give if I am leaving?**

> Two months

**What is the cap on credits in a month?**

> 25%

