# Local answers

Run 2026-10-19 against `onnx-community/Qwen2.5-0.5B-Instruct` at `q4`.

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
| 3 | 2.8 avg | 15/24 | 0/24 | 24/24 |
| 8 | 5.5 avg | 12/24 | 2/24 | 24/24 |
| oracle | the answering one | 14/24 | 2/24 | by construction |

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

> If everything is down, someone gets back to you very quickly.

**Does the response clock keep running through the night?**

> Yes.

**Can I push a ticket up the chain more than once?**

> No, you cannot push a ticket up the chain more than once.

**Does pushing a ticket up make it more urgent?**

> No, pushing a ticket up does not increase its urgency.

**What do I get back if you miss a target?**

> If you miss a target, you will receive credit for that missed target. This credit can be used towards future service costs without requiring payment.

**Do I have to ask for the money back or is it automatic?**

> It depends on your specific situation and circumstances.

**Can your engineers ask for a copy of our live database?**

> Target. They are not a refund and cannot be exchanged for one.

**How long do you keep whatever I attach to a ticket?**

> 90 days after closure.

## Per question

| question | 3 | 8 | oracle |
| -------- | - | - | ------ |
| How quickly does someone get back to me if everything is down? | yes | **no** | **no** |
| How long do you keep whatever I attach to a ticket? | yes | **no** | yes |
| How much warning do I need to give before it renews? | **no** | **no** | **no** |
| What do I get back if you miss a target? | **no** | **no** | **no** |
| The boiler died in January. How fast should someone come? | **no** | **no** | **no** |
| How much notice do I give to move out? | **no** | **no** | **no** |
| How much do I have to hand over at the start? | **no** | **no** | **no** |
| What hours is the standard plan covered? | yes | yes | yes |
| How much force does the press develop? | yes | yes | yes |
| How loud is it at a metre? | yes | yes | yes |
| Which oil grade goes in it? | yes | yes | yes |
| How often does the oil need changing? | yes | **no** | yes |
| What oil temperature is too hot? | yes | yes | yes |
| What torque do the die bolts take? | **no** | **no** | yes |
| How thin can a die be reground before it is scrap? | yes | yes | yes |
| How far apart can the pressure sensors read before it stops? | yes | yes | **no** |
| What humidity needs a desiccant in storage? | yes | yes | yes |
| How much can the rent go up by? | yes | yes | **no** |
| How long does the deposit take to be protected? | **no** | **no** | **no** |
| How fast is a non-emergency repair attended? | **no** | yes | yes |
| How long can a guest stay before I have to tell anyone? | **no** | **no** | **no** |
| How much is the extra deposit for a pet? | yes | yes | yes |
| How much notice do I give if I am leaving? | yes | **no** | yes |
| What is the cap on credits in a month? | yes | yes | yes |

`_missed_` is retrieval not returning the answering passage at that count;
**no** is the model having it and not using it.

## Answers, on the oracle passage

**How quickly does someone get back to me if everything is down?**

> If everything is down, someone gets back to you very quickly.

**How long do you keep whatever I attach to a ticket?**

> 90 days after closure.

**How much warning do I need to give before it renews?**

> According to the passage, cancellation does not close open tickets: they run to resolution under the plan in force when they were raised.

**What do I get back if you miss a target?**

> If you miss a target, you will receive credit for that missed target up to 25% of the total cost per calendar month.

**The boiler died in January. How fast should someone come?**

> emergency repairs are attended within 24 days.

**How much notice do I give to move out?**

> two months

**How much do I have to hand over at the start?**

> To determine how much you need to hand over at the start, let's refer to the relevant information provided in the passage:
> 
> According to the passage, "Rent is reviewed once per year on the anniversary of the tenancy start date."
> 
> This indicates that the amount required to be paid at the start depends on whether the tenancy started in the current year or not.
> 
> Since the passage doesn't provide specific details regarding the starting year, we can infer that the amount needed to be paid at the start would depend on the starting year. However, since no other information is provided, we cannot definitively calculate the amount based solely on the passage.
> 
> Therefore, without additional information, it is impossible to accurately calculate the amount you should hand over at the start.

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

> oil temperature above 70°C

**What torque do the die bolts take?**

> 210 Nm

**How thin can a die be reground before it is scrap?**

> A die that has been regground below 38 mm thickness must not be refitted.

**How far apart can the pressure sensors read before it stops?**

> The pressure sensors can read up to [5] bar before they stop.

**What humidity needs a desiccant in storage?**

> Storage humidity above 60% requires a desiccant in the control cabinet.

**How much can the rent go up by?**

> The rental amount can increase by up to [1] percent.

**How long does the deposit take to be protected?**

> The deposit is five weeks' rent and is registered with an approved protection scheme within [1] weeks of receipt.

**How fast is a non-emergency repair attended?**

> within 14 days.

**How long can a guest stay before I have to tell anyone?**

> 28 nights

**How much is the extra deposit for a pet?**

> One week's rent

**How much notice do I give if I am leaving?**

> To determine how much notice you should give if you are leaving, follow these steps based on the information provided:
> 
> 1. **Understand the Tenancy Period**: According to the first paragraph, after the fixed term (which is described as "one month"), the tenancy continues monthly. This indicates that there is a specific period during which tenants have rights and obligations.
> 
> 2. **Identify Notice Requirements**: The second paragraph mentions that notices must be in writing. This suggests that there are specific legal requirements regarding the timing and form of notices required to terminate a lease agreement.
> 
> 3. **Determine the Duration of Notice**: The third paragraph states that a notice served by message or spoken in person has no effect. This implies that there is a requirement for a formal notice to be issued.
> 
> Given these points:
> - The notice period starts after the fixed term.
> - It ends after another month.
> - There is a requirement for a formal notice to be issued.
> 
> **Conclusion**: To ensure proper notice procedures, you should provide at least one month’s notice before terminating your tenancy agreement. Additionally, you should consider providing a formal notice upon termination to comply fully with the legal requirements outlined in the text.

**What is the cap on credits in a month?**

> The cap on credits in a month is 25%.

