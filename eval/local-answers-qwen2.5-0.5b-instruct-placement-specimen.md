# Local answers

Run 2026-08-31 against `onnx-community/Qwen2.5-0.5B-Instruct` at `q4`.

**Not the shipped prompt.** Added: a placement line (quoting a specimen).

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
| oracle | the answering one | 15/24 | 3/24 | by construction |

## Prose questions, on the oracle passage

Whether the zero above is the device or the question. These want prose,
not a value, which is the shape ADR 033 saw markers on — same CPU path.
A refusal is separated because rule 4 forbids citing one.

**Cited 2/8**, refused 0/8.

| question | cited | refused |
| -------- | ----- | ------- |
| How quickly does someone get back to me if everything is down? | yes | no |
| Does the response clock keep running through the night? | **no** | no |
| Can I push a ticket up the chain more than once? | **no** | no |
| Does pushing a ticket up make it more urgent? | **no** | no |
| What do I get back if you miss a target? | **no** | no |
| Do I have to ask for the money back or is it automatic? | **no** | no |
| Can your engineers ask for a copy of our live database? | **no** | no |
| How long do you keep whatever I attach to a ticket? | yes | no |

### Prose answers

**How quickly does someone get back to me if everything is down?**

> 30 days [1]

**Does the response clock keep running through the night?**

> Yes, the response clock does not run during nighttime on standard plans.

**Can I push a ticket up the chain more than once?**

> No, you cannot push a ticket up the chain more than once.

**Does pushing a ticket up make it more urgent?**

> No, pushing a ticket up does not increase its urgency.

**What do I get back if you miss a target?**

> If you miss a target, you will receive credit for that missed target. This credit can be used towards future service costs without requiring payment.

**Do I have to ask for the money back or is it automatic?**

> It depends on the specific situation and circumstances.

**Can your engineers ask for a copy of our live database?**

> They are not a refund and cannot be exchanged for one.

**How long do you keep whatever I attach to a ticket?**

> 90 days [1]

## Per question

| question | 3 | oracle |
| -------- | - | ------ |
| How quickly does someone get back to me if everything is down? | **no** | **no** |
| How long do you keep whatever I attach to a ticket? | yes | yes |
| How much warning do I need to give before it renews? | **no** | **no** |
| What do I get back if you miss a target? | **no** | **no** |
| The boiler died in January. How fast should someone come? | **no** | **no** |
| How much notice do I give to move out? | yes | yes |
| How much do I have to hand over at the start? | **no** | yes |
| What hours is the standard plan covered? | yes | yes |
| How much force does the press develop? | yes | yes |
| How loud is it at a metre? | yes | yes |
| Which oil grade goes in it? | yes | yes |
| How often does the oil need changing? | yes | yes |
| What oil temperature is too hot? | yes | yes |
| What torque do the die bolts take? | yes | yes |
| How thin can a die be reground before it is scrap? | yes | yes |
| How far apart can the pressure sensors read before it stops? | yes | yes |
| What humidity needs a desiccant in storage? | yes | **no** |
| How much can the rent go up by? | yes | **no** |
| How long does the deposit take to be protected? | **no** | **no** |
| How fast is a non-emergency repair attended? | **no** | yes |
| How long can a guest stay before I have to tell anyone? | **no** | **no** |
| How much is the extra deposit for a pet? | yes | yes |
| How much notice do I give if I am leaving? | **no** | **no** |
| What is the cap on credits in a month? | yes | yes |

`_missed_` is retrieval not returning the answering passage at that count;
**no** is the model having it and not using it.

## Answers, on the oracle passage

**How quickly does someone get back to me if everything is down?**

> 30 days [1]

**How long do you keep whatever I attach to a ticket?**

> 90 days [1]

**How much warning do I need to give before it renews?**

> downgrading from Premier to Standard takes effect at renewal, never mid-term, because the coverage-hours difference would otherwise change the target on tickets already in flight.

**What do I get back if you miss a target?**

> If you miss a target, you will receive credit for that missed target. This credit can be used towards future service costs without requiring payment.

**The boiler died in January. How fast should someone come?**

> emergency repairs are attended within 24 days

**How much notice do I give to move out?**

> Two months

**How much do I have to hand over at the start?**

> To determine how much you need to hand over at the start, we need to refer to the information provided in the first passage. According to the passage, the deposit amount is stated as follows:
> 
> "The deposit is five weeks' rent and is registered with an approved protection scheme within 30 days of receipt."
> 
> This indicates that the deposit amount is calculated based on the duration of the rental period (five weeks) and the specific conditions set by the landlord regarding deposits. Therefore, the deposit amount you should hand over at the start depends on these factors:
> 
> 1. Duration of the rental: Five weeks.
> 2. Conditions for deposits: No additional conditions mentioned.
> 
> So, the deposit amount you should hand over at the start is **5 weeks**.

**What hours is the standard plan covered?**

> 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country.

**How much force does the press develop?**

> 90 kilonewtons

**How loud is it at a metre?**

> 84 dB

**Which oil grade goes in it?**

> ISO VG 46

**How often does the oil need changing?**

> Every 2,000 operating hours or annually.

**What oil temperature is too hot?**

> oil temperature above 70°C

**What torque do the die bolts take?**

> 210 Nm

**How thin can a die be reground before it is scrap?**

> 38 mm

**How far apart can the pressure sensors read before it stops?**

> 5 bar

**What humidity needs a desiccant in storage?**

> For storage over three months, [1] the guard needs a desiccant in the control cabinet regardless of duration.

**How much can the rent go up by?**

> The rental amount can increase by up to [2]%.

**How long does the deposit take to be protected?**

> Five weeks.

**How fast is a non-emergency repair attended?**

> emergency repairs are attended within 14 days.

**How long can a guest stay before I have to tell anyone?**

> 28 days

**How much is the extra deposit for a pet?**

> One week's rent

**How much notice do I give if I am leaving?**

> Two months

**What is the cap on credits in a month?**

> 25%

