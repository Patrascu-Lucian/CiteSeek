# Local answers, in a browser

Run 2026-10-22 against `http://localhost:3000`, on WebGPU.

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
| How quickly does someone get back to me if everything is down? | yes | 0 |
| How long do you keep whatever I attach to a ticket? | yes | 0 |
| How much warning do I need to give before it renews? | **no** | 0 |
| What do I get back if you miss a target? | **no** | 0 |
| The boiler died in January. How fast should someone come? | **no** | 0 |
| How much notice do I give to move out? | **no** | 0 |
| How much do I have to hand over at the start? | **no** | 0 |
| What hours is the standard plan covered? | yes | 0 |
| How much force does the press develop? | yes | 0 |
| How loud is it at a metre? | yes | 0 |
| Which oil grade goes in it? | yes | 0 |
| How often does the oil need changing? | yes | 0 |
| What oil temperature is too hot? | yes | 0 |
| What torque do the die bolts take? | **no** | 0 |
| How thin can a die be reground before it is scrap? | yes | 0 |
| How far apart can the pressure sensors read before it stops? | yes | 0 |
| What humidity needs a desiccant in storage? | yes | 0 |
| How much can the rent go up by? | yes | 0 |
| How long does the deposit take to be protected? | **no** | 0 |
| How fast is a non-emergency repair attended? | **no** | 0 |
| How long can a guest stay before I have to tell anyone? | **no** | 0 |
| How much is the extra deposit for a pet? | yes | 0 |
| How much notice do I give if I am leaving? | yes | 0 |
| What is the cap on credits in a month? | yes | 0 |

## Answers

Verbatim, including the model's own spelling — "regground", "every 1 years".
Correcting those edits the evidence.

**How quickly does someone get back to me if everything is down?**

> It depends on the severity level of the defect. For defects with a work-around, it takes 30 minutes to resolve. For defects without a workaround, it takes 24 hours.

**How long do you keep whatever I attach to a ticket?**

> 90 days after closure.

**How much warning do I need to give before it renews?**

> The landlord requires 24 hours' written notice before entering, except in an emergency where entry may be immediate.

**What do I get back if you miss a target?**

> If you miss a target, you receive a credit towards your next invoice and cannot be exchanged for one.

**The boiler died in January. How fast should someone come?**

> The boiler died in January. Someone should come immediately to inspect and fix the issue.

**How much notice do I give to move out?**

> two months'.

**How much do I have to hand over at the start?**

> To determine how much you need to hand over at the start, we need to refer to the relevant clause in your property agreement. According to the information provided, the standard term specifies that rent is payable monthly in advance on the first day of each month. Therefore, the amount you should hand over at the start depends on whether you are renting under a fixed-rate lease or a variable-rate lease.
> 
> If you are renting under a fixed-rate lease:
> 
> The amount you should hand over at the start would be the full monthly rent amount.
> For example, if your monthly rent is $1000, you would hand over $1000 at the start.
> 
> If you are renting under a variable-rate lease:
> 
> The amount you should hand over at the start would depend on the rate used.
> For example, if your rental rate is $1200 per month, you would hand over $1200 at the start.
> 
> Please consult your property agreement for the specific details regarding the starting amount.

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

> To determine the torque required for the die bolts, we need to refer to the relevant section of the manual. According to the passage, the torque requirement for the die bolts is specified as follows:
> 
> "The torque required for the die bolts is specified as follows."
> 
> So, based on the instruction provided in the manual, the torque required for the die bolts should be determined according to that specific instruction.

**How thin can a die be reground before it is scrap?**

> 38 mm

**How far apart can the pressure sensors read before it stops?**

> 5 bar

**What humidity needs a desiccant in storage?**

> Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration.

**How much can the rent go up by?**

> The rental amount can increase by up to 4% annually.

**How long does the deposit take to be protected?**

> Three weeks.

**How fast is a non-emergency repair attended?**

> 24 hours

**How long can a guest stay before I have to tell anyone?**

> 28 nights

**How much is the extra deposit for a pet?**

> One week's rent

**How much notice do I give if I am leaving?**

> To determine how much notice you should give if you are leaving, follow these steps based on the relevant sections of your tenancy agreement:
> 
> Understand the Tenancy Agreement: Refer to the section specifically addressing your situation (e.g., "Notice must be in writing").
> Identify Key Terms: Look for terms related to notice periods and duration. Typically, notice periods are specified in the agreement.
> Determine Duration: Based on the notice period mentioned in the agreement, calculate the total duration of notice required.
> Example Calculation:
> Notice Period: 2 months
> Total Duration of Notice Required: 2 months + 1 month = 3 months
> 
> So, if you are leaving after 3 months, you should provide 3 months of notice.
> 
> Final Answer: To determine how much notice you should give if you are leaving, refer to the section specifically addressing your situation (e.g., "Notice must be in

**What is the cap on credits in a month?**

> The cap on credits in a month is 25%.

