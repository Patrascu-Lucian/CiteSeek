# Local answers

Run 2026-08-30 against `onnx-community/Qwen2.5-0.5B-Instruct` at `q4`.

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

| passages asked | actually given | grounded | cited | answer retrieved |
| -------------- | -------------- | -------- | ----- | ---------------- |
| 3 | 2.8 avg | 15/24 | 0/24 | 24/24 |
| 8 | 5.5 avg | 13/24 | 2/24 | 24/24 |
| oracle | the answering one | 17/24 | 1/24 | by construction |

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

> Yes.

**Can I push a ticket up the chain more than once?**

> No, you cannot push a ticket up the chain more than once.

**Does pushing a ticket up make it more urgent?**

> No, pushing a ticket up does not increase its urgency.

**What do I get back if you miss a target?**

> If you miss a target, you will receive credit for that missed target. This credit can be used towards future service costs without requiring payment.

**Do I have to ask for the money back or is it automatic?**

> The credits are the only remedy for a missed target. They are not a refund and cannot be exchanged for one.

**Can your engineers ask for a copy of our live database?**

> No, they cannot.

**How long do you keep whatever I attach to a ticket?**

> 90 days.

## Per question

| question | 3 | 8 | oracle |
| -------- | - | - | ------ |
| How quickly does someone get back to me if everything is down? | **no** | yes | yes |
| How long do you keep whatever I attach to a ticket? | yes | **no** | yes |
| How much warning do I need to give before it renews? | **no** | **no** | **no** |
| What do I get back if you miss a target? | **no** | **no** | **no** |
| The boiler died in January. How fast should someone come? | **no** | **no** | **no** |
| How much notice do I give to move out? | yes | **no** | **no** |
| How much do I have to hand over at the start? | **no** | **no** | yes |
| What hours is the standard plan covered? | **no** | yes | yes |
| How much force does the press develop? | yes | yes | yes |
| How loud is it at a metre? | yes | yes | yes |
| Which oil grade goes in it? | yes | yes | yes |
| How often does the oil need changing? | yes | **no** | yes |
| What oil temperature is too hot? | yes | yes | yes |
| What torque do the die bolts take? | yes | **no** | yes |
| How thin can a die be reground before it is scrap? | yes | yes | yes |
| How far apart can the pressure sensors read before it stops? | yes | yes | yes |
| What humidity needs a desiccant in storage? | yes | yes | yes |
| How much can the rent go up by? | yes | yes | yes |
| How long does the deposit take to be protected? | yes | **no** | **no** |
| How fast is a non-emergency repair attended? | **no** | yes | yes |
| How long can a guest stay before I have to tell anyone? | **no** | **no** | **no** |
| How much is the extra deposit for a pet? | yes | yes | yes |
| How much notice do I give if I am leaving? | **no** | **no** | **no** |
| What is the cap on credits in a month? | yes | yes | yes |

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

**How much force does the press develop?**

> 90 kilonewtons

**How loud is it at a metre?**

> 84 dB

**Which oil grade goes in it?**

> ISO VG 46 mineral oil

**How often does the oil need changing?**

> Every 2,000 operating hours or annually.

**What oil temperature is too hot?**

> 70°C

**What torque do the die bolts take?**

> 210 Nm

**How thin can a die be reground before it is scrap?**

> The passage mentions that a die that has been reground below 38 mm thickness must not be refitted. Therefore, the correct answer is that a die that has been regground below 38 mm thickness must not be refitted.

**How far apart can the pressure sensors read before it stops?**

> The pressure sensors can read up to 5 bars before stopping.

**What humidity needs a desiccant in storage?**

> Storage humidity above 60% requires a desiccant in the control cabinet.

**How much can the rent go up by?**

> The rental amount can increase by up to 4% annually.

**How long does the deposit take to be protected?**

> The deposit is five weeks' rent and is registered with an approved protection scheme within [1] weeks of receipt.

**How fast is a non-emergency repair attended?**

> An emergency means loss of heat in winter, loss of water, an unsecured entrance, or anything presenting a risk to health. Non-emergency repairs are attended within 14 days.

**How long can a guest stay before I have to tell anyone?**

> 28 nights

**How much is the extra deposit for a pet?**

> One week's rent

**How much notice do I give if I am leaving?**

> The notice period is specified in the agreement between the landlord and tenant.

**What is the cap on credits in a month?**

> The cap on credits in a month is 25%.

