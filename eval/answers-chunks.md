# What Gemini answers at each chunk size, 8 passages

Run 2026-10-18 by `pnpm eval:answers`: the 24 value
questions in `ANSWER_SET`, against the three eval fixtures ingested through
the shipped pipeline and retrieved with `retrieveChunks`, floor included.
3 runs; a question's result is the majority of them.

Each size keeps the shipped ratio of maximum and overlap to target, and is
ingested into a workspace of its own. At the same passage count a larger
chunk shows more of a small corpus, so a gain that tracks the characters
given is the corpus's, not the size's.

| target | max | overlap | corpus passages | mean passage length |
| ------ | --- | ------- | --------------- | ------------------- |
| 400 | 533 | 67 | 41 | 295 |
| 600 | 800 | 100 | 25 | 473 |
| 800 | 1067 | 133 | 18 | 648 |

`grounded` is the expected value appearing in the answer, a floor rather than
a grade. `cites` is a marker the page links pointing at a passage that holds
the answer. `declined` is a reply opening in the declining form: on these
questions, a false refusal.

| setting | given (mean) | chars given (mean) | answer retrieved | grounded | grounded per run | cites | cites per run | declined | input tokens (mean) |
| ------- | ------------ | ------------------ | ---------------- | -------- | ---------------- | ----- | ------------- | -------- | ------------------- |
| 400 chars | 6.9 | 2089 | 24/24 | 23/24 | 23, 23, 23 | 22/24 | 22, 22, 22 | 2/24 | 1092 |
| 600 chars | 5.8 | 2775 | 24/24 | 23/24 | 23, 23, 23 | 24/24 | 24, 24, 24 | 0/24 | 1213 |
| 800 chars | 4.8 | 3122 | 24/24 | 23/24 | 23, 23, 23 | 24/24 | 24, 24, 24 | 0/24 | 1264 |

## The comparison, by a rule committed before this run

Against the shipped 600 characters: a setting replaces it only if no question gets worse on
either outcome and at least three get better.

**400 chars: keep.**

- grounded: gained none; lost none
- cites: gained none; lost "How much warning do I need to give before it renews?", "How much do I have to hand over at the start?"

**800 chars: keep.**

- grounded: gained none; lost none
- cites: gained none; lost none

## Per question

`_missed_` is retrieval not returning the answering passage for that setting;
**no** is the model having it and not using it.

| question | grounded @400 chars | grounded @600 chars | grounded @800 chars | cites @400 chars | cites @600 chars | cites @800 chars |
| --- | --- | --- | --- | --- | --- | --- |
| How quickly does someone get back to me if everything is down? | yes | yes | yes | yes | yes | yes |
| How long do you keep whatever I attach to a ticket? | yes | yes | yes | yes | yes | yes |
| How much warning do I need to give before it renews? | yes | yes | yes | **no** | yes | yes |
| What do I get back if you miss a target? | yes | yes | yes | yes | yes | yes |
| The boiler died in January. How fast should someone come? | yes | yes | yes | yes | yes | yes |
| How much notice do I give to move out? | **no** | **no** | **no** | yes | yes | yes |
| How much do I have to hand over at the start? | yes | yes | yes | **no** | yes | yes |
| What hours is the standard plan covered? | yes | yes | yes | yes | yes | yes |
| How much force does the press develop? | yes | yes | yes | yes | yes | yes |
| How loud is it at a metre? | yes | yes | yes | yes | yes | yes |
| Which oil grade goes in it? | yes | yes | yes | yes | yes | yes |
| How often does the oil need changing? | yes | yes | yes | yes | yes | yes |
| What oil temperature is too hot? | yes | yes | yes | yes | yes | yes |
| What torque do the die bolts take? | yes | yes | yes | yes | yes | yes |
| How thin can a die be reground before it is scrap? | yes | yes | yes | yes | yes | yes |
| How far apart can the pressure sensors read before it stops? | yes | yes | yes | yes | yes | yes |
| What humidity needs a desiccant in storage? | yes | yes | yes | yes | yes | yes |
| How much can the rent go up by? | yes | yes | yes | yes | yes | yes |
| How long does the deposit take to be protected? | yes | yes | yes | yes | yes | yes |
| How fast is a non-emergency repair attended? | yes | yes | yes | yes | yes | yes |
| How long can a guest stay before I have to tell anyone? | yes | yes | yes | yes | yes | yes |
| How much is the extra deposit for a pet? | yes | yes | yes | yes | yes | yes |
| How much notice do I give if I am leaving? | yes | yes | yes | yes | yes | yes |
| What is the cap on credits in a month? | yes | yes | yes | yes | yes | yes |

## 400 chars — run 1 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

The first response target for Severity 1 tickets (when everything is down) is 30 minutes, measured from ticket creation rather than the start of business hours [3]. 

However, if you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes [1][5]. If you are on a Premier plan, coverage is continuous, including weekends and holidays [5].

## 400 chars — run 2 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

For a Severity 1 issue (such as when everything is down), the first response target is 30 minutes from ticket creation [3]. 

If you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00, Monday to Friday, in your registered timezone, excluding public holidays), the ticket is queued and the 30-minute clock begins when coverage resumes [1][5]. Premier plans are covered continuously, including weekends and holidays [5].

## 400 chars — run 3 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

The first response target for Severity 1 tickets (when everything is down) is 30 minutes, measured from ticket creation [3]. 

However, if you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes [1][5]. Premier plans are covered continuously, including weekends and holidays [5].

## 400 chars — run 1 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything a customer sends is deleted from the ticket system 90 days after closure [1][2].

## 400 chars — run 2 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything sent to the ticket system is deleted 90 days after closure [1][2].

## 400 chars — run 3 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything sent to the ticket system is deleted 90 days after closure [1][2].

## 400 chars — run 1 — How much warning do I need to give before it renews?

Grounded: true · cites: false · declined: true

The documents do not cover how much warning you need to give before a tenancy renews, but they do cover support plan renewals, which require cancellation 30 days before the renewal date [1].

## 400 chars — run 2 — How much warning do I need to give before it renews?

Grounded: true · cites: false · declined: true

The documents do not cover warning periods before a tenancy renews, but they do cover support plans, which renew annually unless cancelled 30 days before the renewal date [1].

## 400 chars — run 3 — How much warning do I need to give before it renews?

Grounded: true · cites: true · declined: false

For a Meridian support plan, you need to cancel 30 days before the renewal date [1]. 

The documents do not cover how much warning is required before other types of agreements renew, but they do cover tenancy notices (such as one month's notice from the tenant after the fixed term) [2] and rent reviews (requiring two months' written notice) [5].

## 400 chars — run 1 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

Missing a first response target on a Premier plan credits 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 

These credits are applied automatically to the next invoice and do not require you to claim them [1][2]. Credits are the only remedy for a missed target; they are not a refund and cannot be exchanged for one [1].

## 400 chars — run 2 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

Missing a first response target on a Premier plan credits 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 

Credits are applied automatically to the next invoice and do not require you to claim them [1][2]. They are the only remedy for a missed target, are not a refund, and cannot be exchanged for one [1].

## 400 chars — run 3 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

Missing a first response target on a Premier plan credits 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 

These credits are applied automatically to the next invoice and cannot be exchanged for a refund [1][2].

## 400 chars — run 1 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

An emergency repair, which includes a loss of heat in winter, is attended within 24 hours [1].

## 400 chars — run 2 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

An emergency repair—which includes a loss of heat in winter—is attended within 24 hours [1].

## 400 chars — run 3 — The boiler died in January. How fast should someone come?

Grounded: true · cites: false · declined: true

The documents do not cover boiler repairs specifically, but they cover emergency repairs, which include a loss of heat in winter [1]. Emergency repairs are attended within 24 hours [1].

## 400 chars — run 1 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

After the fixed term, the tenant must give one month's notice ending on a rent payment date [2].

## 400 chars — run 2 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

After the fixed term, the tenant gives one month's notice ending on a rent payment date [2].

## 400 chars — run 3 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

After the fixed term, the tenant gives one month's notice ending on a rent payment date [2].

## 400 chars — run 1 — How much do I have to hand over at the start?

Grounded: true · cites: false · declined: true

The documents do not cover the total amount you have to hand over at the start, but they do state that the deposit is five weeks' rent [1].

## 400 chars — run 2 — How much do I have to hand over at the start?

Grounded: true · cites: false · declined: true

The documents do not cover the total amount to hand over at the start, but they do state that the deposit is five weeks' rent [1], and that pets carry an additional deposit of one week's rent [3].

## 400 chars — run 3 — How much do I have to hand over at the start?

Grounded: true · cites: false · declined: true

The documents do not cover the total amount to hand over at the start, though they state that the deposit is five weeks' rent [1].

## 400 chars — run 1 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [2].

## 400 chars — run 2 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [2].

## 400 chars — run 3 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [2].

## 400 chars — run 1 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 400 chars — run 2 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 400 chars — run 3 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 400 chars — run 1 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press itself measures 84 dB at one metre [1].

## 400 chars — run 2 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press itself measures 84 dB at one metre [1].

## 400 chars — run 3 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press itself measures 84 dB at one metre [1].

## 400 chars — run 1 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

The documents specify that you should use ISO VG 46 mineral oil [1].

## 400 chars — run 2 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

The documents cover the Harbourline HL-90 Bench Press and state that you should use ISO VG 46 mineral oil [1][5].

## 400 chars — run 3 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

The documents specify that you should use ISO VG 46 mineral oil [1].

## 400 chars — run 1 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [1].

## 400 chars — run 2 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [1].

## 400 chars — run 3 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [1].

## 400 chars — run 1 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

An oil temperature above 70°C shortens seal life sharply [1]. Additionally, fault code E04 indicates an over-temperature condition [2].

## 400 chars — run 2 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

An oil temperature above 70°C shortens seal life sharply [1]. Additionally, fault code E04 indicates an over-temperature condition [2].

## 400 chars — run 3 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

Oil temperatures above 70°C shorten seal life sharply [1]. Additionally, an oil temperature of over-temperature triggers fault code E04 [2].

## 400 chars — run 1 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

Dies are held by four M16 bolts torqued to 210 Nm in a diagonal sequence [1].

## 400 chars — run 2 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

Dies are held by four M16 bolts torqued to 210 Nm in a diagonal sequence [1].

## 400 chars — run 3 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

Dies are held by four M16 bolts torqued to 210 Nm in a diagonal sequence [1].

## 400 chars — run 1 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die that has been reground below 38 mm in thickness must not be refitted [1].

## 400 chars — run 2 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die must not be reground below a thickness of 38 mm [1].

## 400 chars — run 3 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die must not be reground below 38 mm in thickness [1].

## 400 chars — run 1 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops if the two pressure sensors differ by more than 5 bar (indicated by fault code E07) [1].

## 400 chars — run 2 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops if the two pressure sensors differ by more than 5 bar [1].

## 400 chars — run 3 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops if the two pressure sensors differ by more than 5 bar (indicated by code E07) [1].

## 400 chars — run 1 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 400 chars — run 2 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 400 chars — run 3 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 400 chars — run 1 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Rent increases are capped at the lower of the consumer price index or 4% [1].

## 400 chars — run 2 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Rent increases are capped at the lower of the consumer price index or 4% [1].

## 400 chars — run 3 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Rent increases are capped at the lower of the consumer price index or 4% [1].

## 400 chars — run 1 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1].

## 400 chars — run 2 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1].

## 400 chars — run 3 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1].

## 400 chars — run 1 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1].

## 400 chars — run 2 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1].

## 400 chars — run 3 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1].

## 400 chars — run 1 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying more than 14 consecutive nights require notification [1].

## 400 chars — run 2 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying for more than 14 consecutive nights require notification [1].

## 400 chars — run 3 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying for more than 14 consecutive nights require notification [1].

## 400 chars — run 1 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 400 chars — run 2 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 400 chars — run 3 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 400 chars — run 1 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

After the fixed term, the tenant gives one month's notice ending on a rent payment date [2].

## 400 chars — run 2 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

After the fixed term, the tenant gives one month's notice ending on a rent payment date [2].

## 400 chars — run 3 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

After the fixed term, the tenant gives one month's notice ending on a rent payment date [2].

## 400 chars — run 1 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits is 25% of the monthly fee in any calendar month [2].

## 400 chars — run 2 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits is 25% of the monthly fee in any calendar month [2].

## 400 chars — run 3 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits is 25% of the monthly fee in any calendar month [2].

## 600 chars — run 1 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

For a Severity 1 issue (when a production system is unavailable to all users), the first response target is 30 minutes from ticket creation [3][4]. 

However, coverage hours depend on your support plan:
* **Premier plans** are covered continuously, including weekends and holidays [1].
* **Standard plans** are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays [1]. If a Severity 1 ticket is raised outside these hours on a Standard plan, it is queued and its 30-minute clock begins when coverage resumes [1].

## 600 chars — run 2 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

For a Severity 1 issue (meaning a production system is unavailable to all users), the first response target is 30 minutes from ticket creation [3][4]. 

However, if you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes [1]. If you are on a Premier plan, coverage is continuous, including weekends and holidays [1].

## 600 chars — run 3 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

For a Severity 1 issue (where a production system is unavailable to all users), the first response target is 30 minutes measured from ticket creation [3][4]. 

However, if you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes [1]. Premier plans are covered continuously [1].

## 600 chars — run 1 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything a customer sends is deleted from the ticket system 90 days after closure [1].

## 600 chars — run 2 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything sent by a customer is deleted from the ticket system 90 days after closure [1].

## 600 chars — run 3 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything a customer sends is deleted from the ticket system 90 days after closure [1].

## 600 chars — run 1 — How much warning do I need to give before it renews?

Grounded: true · cites: true · declined: false

You need to give 30 days' notice before the renewal date to cancel a Meridian support plan [1].

## 600 chars — run 2 — How much warning do I need to give before it renews?

Grounded: true · cites: true · declined: false

You need to give 30 days' notice before the renewal date to cancel a support plan [1].

## 600 chars — run 3 — How much warning do I need to give before it renews?

Grounded: true · cites: true · declined: false

You need to give 30 days' notice before the renewal date to cancel a support plan [1].

## 600 chars — run 1 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

If a first response target is missed on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, up to a maximum cap of 25% in any calendar month [2]. Standard plans do not include service credits [2]. 

These credits are applied automatically to your next invoice without requiring a claim [2]. They serve as the exclusive remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [1][2].

## 600 chars — run 2 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

If a first response target is missed on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, up to a maximum cap of 25% in any calendar month [2]. These credits are applied automatically to your next invoice without needing to be claimed [2]. 

Standard plans do not receive service credits [2]. Note that these credits serve as the sole remedy for a missed target, and they cannot be exchanged for a refund [1][2].

## 600 chars — run 3 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

If a first response target is missed on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, up to a maximum cap of 25% in any calendar month [2]. Standard plans do not carry service credits [2]. 

These credits are applied automatically to your next invoice without requiring you to claim them [2]. They serve as the sole remedy for a missed target, and they are not a refund and cannot be exchanged for one [1][2].

## 600 chars — run 1 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

Emergency repairs, which include the loss of heat in winter, are attended to within 24 hours [1].

## 600 chars — run 2 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

Emergency repairs are attended within 24 hours [1]. A loss of heat in winter is considered an emergency [1].

## 600 chars — run 3 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

An emergency repair for a loss of heat in winter is attended within 24 hours [1].

## 600 chars — run 1 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

After the fixed term, the tenant gives one month's notice ending on a rent payment date [1]. Notice must be in writing [1].

## 600 chars — run 2 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

To end the tenancy after the fixed term, the tenant must give one month's notice ending on a rent payment date [1]. The notice must be in writing, as a notice served by message or spoken in person has no effect [1].

## 600 chars — run 3 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

After the fixed term, the tenant gives one month's notice ending on a rent payment date [1]. Notice must be in writing, as a notice served by message or spoken in person has no effect [1].

## 600 chars — run 1 — How much do I have to hand over at the start?

Grounded: true · cites: true · declined: false

At the start of the tenancy, you must pay:

* **Rent:** Rent is payable monthly in advance on the first day of each month [4].
* **Deposit:** The deposit is five weeks' rent [1].
* **Pet deposit (if applicable):** If you keep a pet in a property with private outdoor space, consent carries an additional deposit of one week's rent [3].

## 600 chars — run 2 — How much do I have to hand over at the start?

Grounded: true · cites: true · declined: false

At the start of the tenancy, you must pay:

* **Rent:** Rent is payable monthly in advance on the first day of each month [4]. 
* **Deposit:** The deposit is equal to five weeks' rent [1].
* **Pets (if applicable):** If you have written consent for a pet (one cat or one dog in properties with private outdoor space), there is an additional deposit of one week's rent [3].

## 600 chars — run 3 — How much do I have to hand over at the start?

Grounded: true · cites: true · declined: false

At the start of the tenancy, you must pay:

* **Rent:** Rent is payable monthly in advance on the first day of each month [4].
* **Deposit:** The deposit is five weeks' rent [1]. 
* **Pet Deposit (if applicable):** If you keep a pet with written consent in a property with private outdoor space, consent carries an additional deposit of one week's rent [3].

## 600 chars — run 1 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## 600 chars — run 2 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## 600 chars — run 3 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## 600 chars — run 1 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 600 chars — run 2 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 600 chars — run 3 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 600 chars — run 1 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press measures 84 dB at one metre [1].

## 600 chars — run 2 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press itself measures 84 dB at one metre [1].

## 600 chars — run 3 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press measures 84 dB at one metre [1].

## 600 chars — run 1 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

ISO VG 46 mineral oil is used in the press, and synthetic alternatives are also compatible [1].

## 600 chars — run 2 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

ISO VG 46 mineral oil should be used [1]. Synthetic alternatives are also compatible [1].

## 600 chars — run 3 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

ISO VG 46 mineral oil is used in the press [1].

## 600 chars — run 1 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

## 600 chars — run 2 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The hydraulic oil should be changed every 2,000 operating hours or annually, whichever comes first [2].

## 600 chars — run 3 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The hydraulic oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

## 600 chars — run 1 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

An oil temperature above 70°C shortens seal life sharply [1]. Additionally, fault code E04 indicates an over-temperature state when the oil is too hot [2].

## 600 chars — run 2 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

An oil temperature above 70°C shortens seal life sharply [1].

## 600 chars — run 3 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

Oil temperatures above 70°C shorten seal life sharply [1].

## 600 chars — run 1 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

## 600 chars — run 2 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

Dies are held by four M16 bolts torqued to 210 Nm in a diagonal sequence [2].

## 600 chars — run 3 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

## 600 chars — run 1 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die that has been reground below 38 mm thickness must not be refitted [1].

## 600 chars — run 2 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die must not be refitted if it has been reground below 38 mm in thickness [1].

## 600 chars — run 3 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die that has been reground below 38 mm thickness must not be refitted [1].

## 600 chars — run 1 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops if the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

## 600 chars — run 2 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

## 600 chars — run 3 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

## 600 chars — run 1 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet [1].

## 600 chars — run 2 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 600 chars — run 3 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 600 chars — run 1 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Any rent increase is capped at the lower of the consumer price index or 4% [1].

## 600 chars — run 2 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Rent increases are capped at the lower of the consumer price index or 4% [1].

## 600 chars — run 3 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Any rent increase is capped at the lower of the consumer price index or 4% [1].

## 600 chars — run 1 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit must be registered with an approved protection scheme within 30 days of receipt [1][2].

## 600 chars — run 2 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit must be registered with an approved protection scheme within 30 days of receipt [1][2].

## 600 chars — run 3 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit must be registered with an approved protection scheme within 30 days of receipt [1][2].

## 600 chars — run 1 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1].

## 600 chars — run 2 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1].

## 600 chars — run 3 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1].

## 600 chars — run 1 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying for more than 14 consecutive nights require notification [2].

## 600 chars — run 2 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying more than 14 consecutive nights require notification [2].

## 600 chars — run 3 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying more than 14 consecutive nights require notification [2].

## 600 chars — run 1 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 600 chars — run 2 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 600 chars — run 3 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 600 chars — run 1 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

After the fixed term, you must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

## 600 chars — run 2 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

If you are the tenant, you must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

## 600 chars — run 3 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

The tenant gives one month's notice ending on a rent payment date [1].

## 600 chars — run 1 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

## 600 chars — run 2 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

## 600 chars — run 3 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

## 800 chars — run 1 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

The first response target for a Severity 1 ticket—defined as a production system being unavailable to all users—is 30 minutes, measured from ticket creation [2][4]. 

However, if you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and its 30-minute clock does not begin until coverage resumes [1][2]. If you are on a Premier plan, coverage is continuous, including weekends and holidays [2].

## 800 chars — run 2 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

When a production system is unavailable to all users (Severity 1), the first response target is 30 minutes, measured from ticket creation [4].

## 800 chars — run 3 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

When a production system is unavailable to all users (Severity 1), the first response target is 30 minutes from ticket creation [4].

## 800 chars — run 1 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything a customer sends is deleted from the ticket system 90 days after closure [2].

## 800 chars — run 2 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything a customer sends is deleted from the ticket system 90 days after closure [2].

## 800 chars — run 3 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything you send is deleted from the ticket system 90 days after closure [2].

## 800 chars — run 1 — How much warning do I need to give before it renews?

Grounded: true · cites: true · declined: false

Support plans renew annually unless cancelled 30 days before the renewal date [1].

## 800 chars — run 2 — How much warning do I need to give before it renews?

Grounded: true · cites: true · declined: false

Support plans renew annually unless cancelled 30 days before the renewal date [1].

## 800 chars — run 3 — How much warning do I need to give before it renews?

Grounded: true · cites: true · declined: false

Support plans renew annually unless cancelled 30 days before the renewal date [1].

## 800 chars — run 1 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

If a first response target is missed on a Premier plan, you receive a service credit of 5% of the monthly fee per missed target, which is capped at 25% in any calendar month [2]. Standard plans carry no service credits [1][2]. 

Credits are applied automatically to the next invoice and do not require you to claim them [1][2]. They are the only remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [1].

## 800 chars — run 2 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

If a first response target is missed on a Premier plan, you receive a service credit of 5% of the monthly fee per missed target, which is capped at 25% in any calendar month [2]. Standard plans carry no service credits [1][2]. 

Credits are applied automatically to the next invoice and do not require you to claim them [1][2]. They are the only remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [1].

## 800 chars — run 3 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

If a first response target is missed on a Premier plan, you receive a service credit of 5% of the monthly fee per missed target, which is capped at 25% in any calendar month [2]. Standard plans carry no service credits [1][2]. 

Credits are applied automatically to the next invoice and do not require you to claim them [1][2]. They are the only remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [1].

## 800 chars — run 1 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

Emergency repairs, which include the loss of heat in winter, are attended within 24 hours [2].

## 800 chars — run 2 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

The landlord is responsible for the heating system [2]. An emergency repair—which includes a loss of heat in winter—is attended within 24 hours [2].

## 800 chars — run 3 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

Emergency repairs are attended within 24 hours [2]. An emergency is defined as including a loss of heat in winter, which applies to a boiler dying in January [2].

## 800 chars — run 1 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

After the fixed term, the tenancy continues monthly, and you must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

## 800 chars — run 2 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

To end the tenancy after the fixed term, the tenant must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

## 800 chars — run 3 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

To end the tenancy after the fixed term, the tenant must give one month's notice, which must end on a rent payment date [1]. Notice must be given in writing [1].

## 800 chars — run 1 — How much do I have to hand over at the start?

Grounded: true · cites: true · declined: false

At the start of the tenancy, you must pay:

* Rent payable monthly in advance on the first day of each month [3].
* A deposit of five weeks' rent [1].
* An additional deposit of one week's rent if you have written consent for a pet (which is granted by default for one cat or one dog in properties with private outdoor space) [2].

## 800 chars — run 2 — How much do I have to hand over at the start?

Grounded: true · cites: true · declined: false

At the start of the tenancy, you must pay:

* Rent payable monthly in advance on the first day of each month [3].
* A deposit of five weeks' rent [1].
* An additional deposit of one week's rent if you have written consent for a pet [2].

## 800 chars — run 3 — How much do I have to hand over at the start?

Grounded: true · cites: true · declined: false

At the start of the tenancy, you must pay:

* **Rent:** Monthly rent, payable in advance on the first day of each month [3]. 
* **Deposit:** Five weeks' rent [1].
* **Pet deposit (if applicable):** An additional one week's rent if you have a pet with written consent [2].

## 800 chars — run 1 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1][2].

## 800 chars — run 2 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [2].

## 800 chars — run 3 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1][2].

## 800 chars — run 1 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 800 chars — run 2 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 800 chars — run 3 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The Harbourline HL-90 Bench Press develops 90 kilonewtons of force [1].

## 800 chars — run 1 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press itself measures 84 dB at one metre [1].

## 800 chars — run 2 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press itself measures 84 dB at one metre [1].

## 800 chars — run 3 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press measures 84 dB at one metre [1].

## 800 chars — run 1 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

The documents cover the Harbourline HL-90 Bench Press and specify using ISO VG 46 mineral oil [1][4]. Synthetic alternatives are also compatible [1].

## 800 chars — run 2 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

ISO VG 46 mineral oil should be used [1]. Synthetic alternatives are also compatible [1].

## 800 chars — run 3 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

The documents cover the Harbourline HL-90 Bench Press and specify using ISO VG 46 mineral oil [1][4]. Synthetic alternatives are also compatible [1].

## 800 chars — run 1 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [1].

## 800 chars — run 2 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [1].

## 800 chars — run 3 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [1].

## 800 chars — run 1 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

An oil temperature above 70°C shortens seal life sharply [1]. Additionally, an oil temperature above this threshold triggers fault code E04 (over-temperature), which latches until the oil falls below 60°C [3].

## 800 chars — run 2 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

An oil temperature above 70°C shortens seal life sharply [1].

## 800 chars — run 3 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

An oil temperature above 70°C shortens seal life sharply [1].

## 800 chars — run 1 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

The die bolts take a torque of 210 Nm [1].

## 800 chars — run 2 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

The die bolts are torqued to 210 Nm in a diagonal sequence [1].

## 800 chars — run 3 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

The die bolts are torqued to 210 Nm [1].

## 800 chars — run 1 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die that has been reground below 38 mm thickness must not be refitted [2].

## 800 chars — run 2 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die that has been reground below 38 mm thickness must not be refitted [2].

## 800 chars — run 3 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die must not be refitted if it has been reground below 38 mm in thickness [2].

## 800 chars — run 1 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops when the two pressure sensors differ by more than 5 bar (indicated by fault code E07) [1].

## 800 chars — run 2 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops if the two pressure sensors differ by more than 5 bar [1].

## 800 chars — run 3 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops if the two pressure sensors differ by more than 5 bar [1].

## 800 chars — run 1 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 800 chars — run 2 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 800 chars — run 3 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 800 chars — run 1 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

The rent increase is capped at the lower of the consumer price index or 4% [1][2].

## 800 chars — run 2 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Rent increases are capped at the lower of the consumer price index or 4% [2].

## 800 chars — run 3 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Rent increases are capped at the lower of the consumer price index or 4% [2].

## 800 chars — run 1 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit is registered with an approved protection scheme within 30 days of receipt [2].

## 800 chars — run 2 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit is registered with an approved protection scheme within 30 days of receipt [2].

## 800 chars — run 3 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit is registered with an approved protection scheme within 30 days of receipt [2].

## 800 chars — run 1 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1][3].

## 800 chars — run 2 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1][3].

## 800 chars — run 3 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1][3].

## 800 chars — run 1 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying for more than 14 consecutive nights require notification [1][2].

## 800 chars — run 2 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying for more than 14 consecutive nights require notification [1][2].

## 800 chars — run 3 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying more than 14 consecutive nights require notification [1][2].

## 800 chars — run 1 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 800 chars — run 2 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 800 chars — run 3 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 800 chars — run 1 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

After the fixed term, the tenancy continues monthly, and you must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

## 800 chars — run 2 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

To end the tenancy, the tenant must give one month's notice, which must end on a rent payment date [1]. The notice must be in writing; notices served by message or spoken in person have no effect [1].

## 800 chars — run 3 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

To end the tenancy after the fixed term, you must give one month's notice in writing, which must end on a rent payment date [1].

## 800 chars — run 1 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits is 25% in any calendar month [2].

## 800 chars — run 2 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits is 25% in any calendar month [2].

## 800 chars — run 3 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits is 25% in any calendar month [2].
