# Local answers, in a browser

Run 2026-08-30 against `http://localhost:3000`, on WebGPU.

The questions and the scorer come from `eval:local-answers`, and retrieval is
the page's own — so this is that harness's 3-passage row, measured
where the product runs. The oracle column has no equivalent: the UI has no way
to hand a passage over.

Each question is asked in its own browser, because `useChat` sends the whole
history and the CPU harness asks every question cold.

`cited` counts **citation chips in the answer**, not `[n]` in the text. Markers
are rewritten into links before rendering, so a bracket never reaches the DOM;
a chip is also the stricter claim, since it resolved to a passage.

**Grounded 15/24, cited 0/24.**
Compare against the 3-passage row of `eval/local-answers.md`, the
same questions on the CPU. The comparison is written up in `docs/backlog.md`
rather than here, because a number copied into two generated files goes stale
in one of them.

## Per question

| question | grounded | chips |
| -------- | -------- | ----- |
| How quickly does someone get back to me if everything is down? | **no** | 0 |
| How long do you keep whatever I attach to a ticket? | yes | 0 |
| How much warning do I need to give before it renews? | **no** | 0 |
| What do I get back if you miss a target? | **no** | 0 |
| The boiler died in January. How fast should someone come? | **no** | 0 |
| How much notice do I give to move out? | yes | 0 |
| How much do I have to hand over at the start? | **no** | 0 |
| What hours is the standard plan covered? | **no** | 0 |
| How much force does the press develop? | yes | 0 |
| How loud is it at a metre? | yes | 0 |
| Which oil grade goes in it? | yes | 0 |
| How often does the oil need changing? | yes | 0 |
| What oil temperature is too hot? | yes | 0 |
| What torque do the die bolts take? | yes | 0 |
| How thin can a die be reground before it is scrap? | yes | 0 |
| How far apart can the pressure sensors read before it stops? | yes | 0 |
| What humidity needs a desiccant in storage? | yes | 0 |
| How much can the rent go up by? | yes | 0 |
| How long does the deposit take to be protected? | yes | 0 |
| How fast is a non-emergency repair attended? | **no** | 0 |
| How long can a guest stay before I have to tell anyone? | **no** | 0 |
| How much is the extra deposit for a pet? | yes | 0 |
| How much notice do I give if I am leaving? | **no** | 0 |
| What is the cap on credits in a month? | yes | 0 |

## Answers

Verbatim, including the model's own spelling — "regground", "every 1 years".
Correcting those edits the evidence.

**How quickly does someone get back to me if everything is down?**

> It depends on the severity level of the defect. For defects with a work-around (Severity 4), the defect resolution time is calculated based on the severity level and the specific circumstances of the defect. The defect resolution time is determined by the following factors:
> 
> Severity Level: The defect resolution time is calculated based on the severity level. Severity 1 corresponds to immediate action, while Severity 4 corresponds to delayed action.
> Specific Circumstances: The specific circumstances of the defect determine how long it takes to resolve it. For example, if the defect causes damage to property, it may take longer to resolve it compared to a defect that affects software code. Therefore, the defect resolution time can vary depending on the severity level and the specific circumstances of the defect.

**How long do you keep whatever I attach to a ticket?**

> 90 days after closure.

**How much warning do I need to give before it renews?**

> The landlord requires 24 hours' written notice before entering, except in an emergency where entry may be immediate.

**What do I get back if you miss a target?**

> If you miss a target, you lose up to 25% of the monthly fee per missed target.

**The boiler died in January. How fast should someone come?**

> At the same interval and not cleanable — a filter that looks clean has usually failed open.

**How much notice do I give to move out?**

> Two months'.

**How much do I have to hand over at the start?**

> To determine how much you need to hand over at the start, we need to refer to the relevant clause in the property agreement. According to the information provided, the standard term specifies that rent is payable monthly in advance on the first day of each month. Therefore, the amount you should hand over at the start depends on whether you are renting under a fixed-rate lease or a variable-rate option.
> 
> If you are renting under a fixed-rate lease:
> 
> The amount you should hand over at the start would be the full monthly rent amount specified in the contract.
> 
> If you are renting under a variable-rate option:
> 
> The amount you should hand over at the start would be the sum of the current month's rent and any additional amounts agreed upon by both parties (e.g., interest charges).
> 
> Please consult the specific clauses related to your rental arrangement to ensure accurate information based on your actual situation.

**What hours is the standard plan covered?**

> The standard plan is covered continuously, including weekends and holidays.

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

> The torque the die bolts take is 210 Nm.

**How thin can a die be reground before it is scrap?**

> The passage mentions that a die that has been regground below 38 mm thickness must not be refitted. Therefore, the correct answer is that a die that has been regground below 38 mm thickness must not be refitted.

**How far apart can the pressure sensors read before it stops?**

> 5 bar

**What humidity needs a desiccant in storage?**

> Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration.

**How much can the rent go up by?**

> The rental amount can increase by up to 4% annually.

**How long does the deposit take to be protected?**

> The deposit is five weeks' rent and is registered with an approved protection scheme within 30 days of receipt.

**How fast is a non-emergency repair attended?**

> An emergency repair must be attended within 24 hours.

**How long can a guest stay before I have to tell anyone?**

> 28 nights

**How much is the extra deposit for a pet?**

> One week's rent

**How much notice do I give if I am leaving?**

> Notice must be in writing.

**What is the cap on credits in a month?**

> The cap on credits in a month is 25%.

