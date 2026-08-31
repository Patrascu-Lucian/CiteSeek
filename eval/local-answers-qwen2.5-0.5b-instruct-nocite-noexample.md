# Local answers

Run 2026-08-31 against `onnx-community/Qwen2.5-0.5B-Instruct` at `q4`.

**Not the shipped prompt**: the citation rules and the worked example removed, to measure what they cost.

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
| 3 | 2.8 avg | 16/24 | 0/24 | 24/24 |
| oracle | the answering one | 17/24 | 0/24 | by construction |

## Prose questions, on the oracle passage

Whether the zero above is the device or the question. These want prose,
not a value, which is the shape ADR 033 saw markers on — same CPU path.
A refusal is separated: the rule forbidding a cited refusal is one of the ones this run removed.

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

> The passage does not provide information about how quickly someone gets back to you if everything is down. It only mentions that defects with workarounds are scheduled against the release train instead of against a clock.

**Does the response clock keep running through the night?**

> Yes, the response clock does not run overnight on a Standard plan.

**Can I push a ticket up the chain more than once?**

> No, you cannot push a ticket up the chain more than once.

**Does pushing a ticket up make it more urgent?**

> No, pushing a ticket up does not increase its urgency.

**What do I get back if you miss a target?**

> If you miss a target, you will receive a credit amount equal to 5% of the monthly fee per missed target, capped at 25%.

**Do I have to ask for the money back or is it automatic?**

> The credits are the only remedy for a missed target. They are not a refund and cannot be exchanged for one.

**Can your engineers ask for a copy of our live database?**

> No, this policy prohibits such requests.

**How long do you keep whatever I attach to a ticket?**

> The given passage states: "Anything a customer does send is deleted from the ticket system 90 days after closure." This indicates that any attachments made to tickets should be deleted after 90 days.

## Per question

| question | 3 | oracle |
| -------- | - | ------ |
| How quickly does someone get back to me if everything is down? | **no** | **no** |
| How long do you keep whatever I attach to a ticket? | **no** | yes |
| How much warning do I need to give before it renews? | **no** | yes |
| What do I get back if you miss a target? | **no** | **no** |
| The boiler died in January. How fast should someone come? | **no** | **no** |
| How much notice do I give to move out? | **no** | **no** |
| How much do I have to hand over at the start? | **no** | yes |
| What hours is the standard plan covered? | yes | yes |
| How much force does the press develop? | yes | yes |
| How loud is it at a metre? | yes | yes |
| Which oil grade goes in it? | yes | yes |
| How often does the oil need changing? | yes | yes |
| What oil temperature is too hot? | yes | yes |
| What torque do the die bolts take? | yes | yes |
| How thin can a die be reground before it is scrap? | yes | yes |
| How far apart can the pressure sensors read before it stops? | yes | **no** |
| What humidity needs a desiccant in storage? | yes | yes |
| How much can the rent go up by? | yes | yes |
| How long does the deposit take to be protected? | yes | **no** |
| How fast is a non-emergency repair attended? | **no** | yes |
| How long can a guest stay before I have to tell anyone? | yes | yes |
| How much is the extra deposit for a pet? | yes | yes |
| How much notice do I give if I am leaving? | yes | **no** |
| What is the cap on credits in a month? | yes | yes |

`_missed_` is retrieval not returning the answering passage at that count;
**no** is the model having it and not using it.

## Answers, on the oracle passage

**How quickly does someone get back to me if everything is down?**

> The passage does not provide information about how quickly someone gets back to you if everything is down. It only mentions that defects with workarounds are scheduled against the release train instead of against a clock.

**How long do you keep whatever I attach to a ticket?**

> The given passage states: "Anything a customer does send is deleted from the ticket system 90 days after closure." This indicates that any attachments made to tickets should be deleted after 90 days.

**How much warning do I need to give before it renews?**

> The passage states that "Support plans renew annually unless cancelled 30 days before the renewal date." Therefore, you should give 30 days' notice before the renewal period begins.

**What do I get back if you miss a target?**

> If you miss a target, you will be charged a percentage of the monthly fee per missed target, capped at 25%.

**The boiler died in January. How fast should someone come?**

> According to the rules provided, if a boiler dies in January, then anyone who can arrange an emergency repair themselves should be able to fix it without needing to contact the landlord immediately.

**How much notice do I give to move out?**

> The notice period for moving out is typically six months.

**How much do I have to hand over at the start?**

> To determine how much you need to hand over at the start, we need to refer to the information provided in the passage. According to the passage, the deposit amount is stated as follows: "The deposit is five weeks' rent." Therefore, the amount you should hand over at the start is five weeks' worth of rent.

**What hours is the standard plan covered?**

> The standard plan is covered from 09:00 to 18:00 in the customer's registered timezone.

**How much force does the press develop?**

> The press develops 90 kilonewtons.

**How loud is it at a metre?**

> The press itself measures 84 dB at one meter, which is below the mandatory threshold.

**Which oil grade goes in it?**

> ISO VG 46 mineral oil

**How often does the oil need changing?**

> The oil needs changing every <span class="mathjax">2,000</span> operating hours or annually.

**What oil temperature is too hot?**

> The oil temperature is above 70°C.

**What torque do the die bolts take?**

> The torque taken by the die bolts is specified to be 210 Nm.

**How thin can a die be reground before it is scrap?**

> The passage states: "The seating face must not be refitted." Therefore, the correct answer is that a die should not be re-ground thinner than 38 mm to avoid being scrapped.

**How far apart can the pressure sensors read before it stops?**

> The pressure sensors disagree by more than 5 bars before they stop reading.

**What humidity needs a desiccant in storage?**

> Storage humidity above 60%.

**How much can the rent go up by?**

> The rental amount can increase by up to 4% annually.

**How long does the deposit take to be protected?**

> The deposit is five weeks' rent and is registered with an approved protection scheme within three months.

**How fast is a non-emergency repair attended?**

> A non-emergency repair is attended within 14 days.

**How long can a guest stay before I have to tell anyone?**

> According to the information provided, guests staying more than 14 consecutive nights require notification. Therefore, the correct answer is **more than 14** consecutive nights.

**How much is the extra deposit for a pet?**

> The extra deposit for a pet is one week's rent.

**How much notice do I give if I am leaving?**

> The notice period for leaving a property typically varies depending on the specific agreement between the landlord and tenant. Generally, there is usually a standard notice period specified in the lease agreement. However, some agreements might have additional provisions for non-standard situations such as moving out due to illness or death of a family member. It's best to refer to the specific terms of your lease agreement for accurate information.

**What is the cap on credits in a month?**

> The cap on credits in a month is 25%.

