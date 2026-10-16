# What Gemini answers, at each passage count

Run 2026-10-16 by `pnpm eval:answers`: the 24 value
questions in `ANSWER_SET`, against the three eval fixtures ingested through
the shipped pipeline and retrieved with `retrieveChunks`, floor included.
3 runs; a question's result is the majority of them. The corpus is
25 passages, so at eight a question sees a large share of it.

`grounded` is the expected value appearing in the answer, a floor rather than
a grade. `cites` is a marker the page links pointing at a passage that holds
the answer. `declined` is a reply opening in the declining form: on these
questions, a false refusal.

| passages | given (mean) | answer retrieved | grounded | grounded per run | cites | cites per run | declined | input tokens (mean) |
| -------- | ------------ | ---------------- | -------- | ---------------- | ----- | ------------- | -------- | ------------------- |
| 3 | 2.9 | 24/24 | 23/24 | 23, 23, 23 | 22/24 | 23, 22, 21 | 2/24 | 845 |
| 8 | 5.8 | 24/24 | 23/24 | 23, 23, 23 | 23/24 | 23, 22, 23 | 0/24 | 1213 |
| oracle | 1.0 | 24/24 | 23/24 | 23, 23, 23 | 21/24 | 21, 20, 21 | 3/24 | 601 |

## The comparison, by the rule committed before this run (ADR 059)

Against the shipped 8: a count replaces it only if no question gets worse
on either outcome and at least one gets better.

**3 passages: keep.**

- grounded: gained none; lost none
- cites: gained "How fast is a non-emergency repair attended?"; lost "How much warning do I need to give before it renews?", "How much do I have to hand over at the start?"

## Per question

`_missed_` is retrieval not returning the answering passage at that count;
**no** is the model having it and not using it.

| question | grounded @3 | grounded @8 | grounded @oracle | cites @3 | cites @8 | cites @oracle |
| --- | --- | --- | --- | --- | --- | --- |
| How quickly does someone get back to me if everything is down? | yes | yes | yes | yes | yes | yes |
| How long do you keep whatever I attach to a ticket? | yes | yes | yes | yes | yes | yes |
| How much warning do I need to give before it renews? | yes | yes | yes | **no** | yes | **no** |
| What do I get back if you miss a target? | yes | yes | yes | yes | yes | **no** |
| The boiler died in January. How fast should someone come? | yes | yes | yes | yes | yes | yes |
| How much notice do I give to move out? | **no** | **no** | **no** | yes | yes | yes |
| How much do I have to hand over at the start? | yes | yes | yes | **no** | yes | **no** |
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
| How fast is a non-emergency repair attended? | yes | yes | yes | yes | **no** | yes |
| How long can a guest stay before I have to tell anyone? | yes | yes | yes | yes | yes | yes |
| How much is the extra deposit for a pet? | yes | yes | yes | yes | yes | yes |
| How much notice do I give if I am leaving? | yes | yes | yes | yes | yes | yes |
| What is the cap on credits in a month? | yes | yes | yes | yes | yes | yes |

## 3 passages — run 1 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

For a Severity 1 issue (such as when everything is down), the first response target is 30 minutes measured from ticket creation [3]. 

However, if you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes—the clock does not run overnight [1]. If you have a Premier plan, coverage is continuous, including weekends and holidays [1].

## 3 passages — run 2 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

For a Severity 1 issue (such as when everything is down), the first response target is 30 minutes measured from ticket creation [3]. 

However, if you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes [1]. Premier plans are covered continuously [1].

## 3 passages — run 3 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

For a Severity 1 ticket (when everything is down), the first response target is 30 minutes from ticket creation [3]. 

However, if you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes, as the clock does not run overnight on a Standard plan [1][3]. If you are on a Premier plan, coverage is continuous, including weekends and holidays [1].

## 3 passages — run 1 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything a customer sends is deleted from the ticket system 90 days after closure [1].

## 3 passages — run 2 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything a customer sends is deleted from the ticket system 90 days after closure [1].

## 3 passages — run 3 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything a customer sends is deleted from the ticket system 90 days after closure [1].

## 3 passages — run 1 — How much warning do I need to give before it renews?

Grounded: true · cites: false · declined: true

The documents do not cover how much warning you need to give before a tenancy renews, but they do cover that support plans renew annually and require cancellation 30 days before the renewal date [1].

## 3 passages — run 2 — How much warning do I need to give before it renews?

Grounded: true · cites: false · declined: true

The documents do not cover how much warning you need to give before a tenancy renews, but they do cover that support plans renew annually and must be cancelled 30 days before the renewal date [1].

## 3 passages — run 3 — How much warning do I need to give before it renews?

Grounded: true · cites: false · declined: true

The documents do not cover how much warning you need to give before a tenancy renews, but they do cover that support plans renew annually and must be cancelled 30 days before the renewal date [1].

## 3 passages — run 1 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

If a Premier plan misses a first response target, you receive a service credit of 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 

These credits are applied automatically to the next invoice and do not require you to claim them [2]. They serve as the only remedy for a missed target, are not a refund, and cannot be exchanged for one [1][2].

## 3 passages — run 2 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

If a first response target is missed on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 

These credits are applied automatically to the next invoice without requiring you to claim them [2]. They serve as the sole remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [2].

## 3 passages — run 3 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

If a Premier plan misses a first response target, you receive a service credit of 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans do not carry service credits [2]. 

These credits are applied automatically to the next invoice and do not require you to claim them [2]. They serve as the only remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [1][2].

## 3 passages — run 1 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

An emergency repair for a loss of heat in winter is attended within 24 hours [1]. If the landlord cannot be reached within four hours, a tenant may arrange the repair themselves and recover the reasonable cost against rent, provided an invoice is produced [1].

## 3 passages — run 2 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

The loss of heat in winter is considered an emergency, and emergency repairs are attended within 24 hours [1].

## 3 passages — run 3 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

Emergency repairs, which include a loss of heat in winter, are attended to within 24 hours [1].

## 3 passages — run 1 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

The tenant gives one month's notice ending on a rent payment date [1].

## 3 passages — run 2 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

You give one month's notice, ending on a rent payment date [1].

## 3 passages — run 3 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

To end the tenancy, the tenant gives one month's notice ending on a rent payment date [1]. Notice must be in writing [1].

## 3 passages — run 1 — How much do I have to hand over at the start?

Grounded: true · cites: true · declined: false

The documents state that the deposit is five weeks' rent [1]. Additionally, if pets are kept, consent carries an additional deposit of one week's rent [3]. The documents do not cover any other amounts required at the start of the tenancy.

## 3 passages — run 2 — How much do I have to hand over at the start?

Grounded: true · cites: false · declined: true

The documents do not cover the total amount to be handed over at the start, though they state that the deposit is five weeks' rent [1].

## 3 passages — run 3 — How much do I have to hand over at the start?

Grounded: true · cites: false · declined: true

The documents do not cover the total amount to be handed over at the start, though they state that the deposit is five weeks' rent [1].

## 3 passages — run 1 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## 3 passages — run 2 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## 3 passages — run 3 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## 3 passages — run 1 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 3 passages — run 2 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 3 passages — run 3 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 3 passages — run 1 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

At one metre, the press itself measures 84 dB [1].

## 3 passages — run 2 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press itself measures 84 dB at one metre [1].

## 3 passages — run 3 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press measures 84 dB at one metre, though workpiece resonance routinely adds 10 to 15 dB [1].

## 3 passages — run 1 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

The documents specify to use ISO VG 46 mineral oil [1].

## 3 passages — run 2 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

ISO VG 46 mineral oil should be used [1]. Synthetic alternatives are also compatible [1].

## 3 passages — run 3 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

ISO VG 46 mineral oil should be used [1]. Synthetic alternatives are also compatible [1].

## 3 passages — run 1 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

## 3 passages — run 2 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

## 3 passages — run 3 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

## 3 passages — run 1 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

An oil temperature above 70°C shortens seal life sharply [1].

## 3 passages — run 2 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

An oil temperature above 70°C shortens seal life sharply [1].

## 3 passages — run 3 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

An oil temperature above 70°C shortens seal life sharply [1].

## 3 passages — run 1 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

## 3 passages — run 2 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

## 3 passages — run 3 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

Dies are held by four M16 bolts torqued to 210 Nm in a diagonal sequence [2].

## 3 passages — run 1 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die must not be refitted if it has been reground below 38 mm in thickness [1].

## 3 passages — run 2 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die that has been reground below 38 mm thickness must not be refitted [1].

## 3 passages — run 3 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die reground below 38 mm thickness must not be refitted [1].

## 3 passages — run 1 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops when the two sensors differ by more than 5 bar [1].

## 3 passages — run 2 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops if the two pressure sensors differ by more than 5 bar [1].

## 3 passages — run 3 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops when the two pressure sensors differ by more than 5 bar [1].

## 3 passages — run 1 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 3 passages — run 2 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 3 passages — run 3 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 3 passages — run 1 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Rent increases are capped at the lower of the consumer price index or 4% [1].

## 3 passages — run 2 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Rent increases are capped at the lower of the consumer price index or 4% [1].

## 3 passages — run 3 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

The rent increase is capped at the lower of the consumer price index or 4% [1].

## 3 passages — run 1 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## 3 passages — run 2 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit must be registered with an approved protection scheme within 30 days of receipt [1][2].

## 3 passages — run 3 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit must be registered with an approved protection scheme within 30 days of receipt [1][2].

## 3 passages — run 1 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1].

## 3 passages — run 2 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1].

## 3 passages — run 3 — How fast is a non-emergency repair attended?

Grounded: true · cites: false · declined: false

Non-emergency repairs are attended within 14 days.

## 3 passages — run 1 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying more than 14 consecutive nights require notification [2].

## 3 passages — run 2 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying more than 14 consecutive nights require notification [2].

## 3 passages — run 3 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying more than 14 consecutive nights require notification [2].

## 3 passages — run 1 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 3 passages — run 2 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 3 passages — run 3 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 3 passages — run 1 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

After the fixed term, the tenant must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

## 3 passages — run 2 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

The tenant must give one month's notice ending on a rent payment date, which must be in writing [1].

## 3 passages — run 3 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

The tenant must give one month's notice, ending on a rent payment date [1].

## 3 passages — run 1 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits is 25% of the monthly fee in any calendar month [1].

## 3 passages — run 2 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

## 3 passages — run 3 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits is 25% of the monthly fee in any calendar month [1].

## 8 passages — run 1 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

For a Severity 1 issue (where a production system is unavailable to all users), the first response target is 30 minutes from ticket creation [3][4]. 

However, if you are on a Standard plan and raise the ticket outside of coverage hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the clock does not run overnight; the ticket is queued and begins its 30-minute clock when coverage resumes [1]. If you are on a Premier plan, coverage is continuous, including weekends and holidays [1].

## 8 passages — run 2 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

The first response target for Severity 1 tickets (which apply when a production system is unavailable to all users) is 30 minutes, measured from ticket creation [3][4]. 

If you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock begins when coverage resumes, as the clock does not run overnight on a Standard plan [1]. Premier plans, by contrast, are covered continuously [1].

## 8 passages — run 3 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

For a Severity 1 issue (when a production system is unavailable to all users), the first response target is 30 minutes measured from ticket creation [3][4]. 

If you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and begins its 30-minute clock when coverage resumes, as the clock does not run overnight [1]. If you are on a Premier plan, coverage is continuous, including weekends and holidays [1].

## 8 passages — run 1 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything a customer sends is deleted from the ticket system 90 days after closure [1].

## 8 passages — run 2 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything a customer sends is deleted from the ticket system 90 days after closure [1].

## 8 passages — run 3 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything sent to the ticket system is deleted 90 days after closure [1].

## 8 passages — run 1 — How much warning do I need to give before it renews?

Grounded: true · cites: true · declined: false

You need to give 30 days' notice before the renewal date to cancel a support plan [1].

## 8 passages — run 2 — How much warning do I need to give before it renews?

Grounded: true · cites: true · declined: false

You need to give 30 days' notice before the renewal date to cancel a support plan [1].

## 8 passages — run 3 — How much warning do I need to give before it renews?

Grounded: true · cites: true · declined: false

You need to give 30 days' notice before the renewal date to cancel a support plan [1].

## 8 passages — run 1 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

On a Premier plan, missing a first response target credits 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 

These credits are applied automatically to the next invoice without requiring a claim [2]. They serve as the only remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [1][2].

## 8 passages — run 2 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

If a Premier plan misses a first response target, you receive a credit of 5% of the monthly fee per missed target, which is capped at 25% in any calendar month [2]. These credits are applied automatically to the next invoice and do not require you to claim them [2]. 

Standard plans carry no service credits [2]. Note that credits are the only remedy for a missed target; they are not a refund and cannot be exchanged for one [1][2].

## 8 passages — run 3 — What do I get back if you miss a target?

Grounded: true · cites: true · declined: false

If a first response target is missed on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, up to a maximum cap of 25% in any calendar month [2]. Standard plans do not carry service credits [2]. 

These credits are applied automatically to your next invoice without requiring you to claim them [2]. They serve as the only remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [1][2].

## 8 passages — run 1 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

The documents cover repairs and emergency response times for a tenancy agreement. 

Emergency repairs are attended within 24 hours, where an emergency includes a loss of heat in winter, loss of water, an unsecured entrance, or anything presenting a risk to health [1].

## 8 passages — run 2 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

Emergency repairs are attended within 24 hours [1]. An emergency includes the loss of heat in winter [1].

## 8 passages — run 3 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

A loss of heat in winter is classified as an emergency repair [1]. Emergency repairs are attended within 24 hours [1]. If the landlord cannot be reached within four hours, the tenant may arrange the repair themselves and recover the reasonable cost against the rent, provided they produce the invoice [1].

## 8 passages — run 1 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

After the fixed term, the tenant must give one month's notice ending on a rent payment date [1]. Notice must be in writing [1].

## 8 passages — run 2 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

The tenant gives one month's notice ending on a rent payment date [1].

## 8 passages — run 3 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

After the fixed term, the tenant gives one month's notice ending on a rent payment date [1]. Notice must be in writing [1].

## 8 passages — run 1 — How much do I have to hand over at the start?

Grounded: true · cites: true · declined: false

At the start of the tenancy, you must pay:

* **Rent:** Rent is payable monthly in advance on the first day of each month [4].
* **Deposit:** The deposit is five weeks' rent [1]. 
* **Pets (if applicable):** If you have a pet with written consent in a property with private outdoor space, consent carries an additional deposit of one week's rent [3].

## 8 passages — run 2 — How much do I have to hand over at the start?

Grounded: true · cites: true · declined: false

At the start of the tenancy, you must pay:

* **Rent:** Rent is payable monthly in advance on the first day of each month [4].
* **Deposit:** The deposit is five weeks' rent [1]. 
* **Pet Deposit (if applicable):** If you have written consent for a pet (granted by default for one cat or one dog in properties with private outdoor space), consent carries an additional deposit of one week's rent [3].

## 8 passages — run 3 — How much do I have to hand over at the start?

Grounded: true · cites: true · declined: false

At the start of the tenancy, you must pay:

* **Rent:** Rent is payable monthly in advance on the first day of each month [4].
* **Deposit:** The deposit is five weeks' rent [1].
* **Additional deposit (if applicable):** If you have written consent for a pet (one cat or one dog in a property with private outdoor space), consent carries an additional deposit of one week's rent [3].

## 8 passages — run 1 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## 8 passages — run 2 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## 8 passages — run 3 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## 8 passages — run 1 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 8 passages — run 2 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 8 passages — run 3 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## 8 passages — run 1 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press itself measures 84 dB at one metre [1].

## 8 passages — run 2 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press itself measures 84 dB at one metre [1].

## 8 passages — run 3 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

The press itself measures 84 dB at one metre [1].

## 8 passages — run 1 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

The documents cover the Harbourline HL-90 Bench Press operating manual, including safety, hydraulic oil requirements, die changes, daily checks, and fault codes [1][2][3][4][5]. 

ISO VG 46 mineral oil is used in the press [1]. Synthetic alternatives are also compatible [1].

## 8 passages — run 2 — Which oil grade goes in it?

Grounded: true · cites: false · declined: false

The press uses ISO VG 46 mineral oil (synthetic alternatives are also compatible).

## 8 passages — run 3 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

The documents specify that you should use ISO VG 46 mineral oil [1]. Synthetic alternatives are also compatible [1].

## 8 passages — run 1 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The hydraulic oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

## 8 passages — run 2 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The hydraulic oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

## 8 passages — run 3 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The hydraulic oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

## 8 passages — run 1 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

Oil temperatures above 70°C shorten seal life sharply [1].

## 8 passages — run 2 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

An oil temperature above 70°C sharply shortens seal life [1].

## 8 passages — run 3 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

An oil temperature above 70°C shortens seal life sharply [1].

## 8 passages — run 1 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

## 8 passages — run 2 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

## 8 passages — run 3 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

## 8 passages — run 1 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die must not be refitted if it has been reground below 38 mm in thickness [1].

## 8 passages — run 2 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die that has been reground below 38 mm thickness must not be refitted [1].

## 8 passages — run 3 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die that has been reground below 38 mm thickness must not be refitted [1].

## 8 passages — run 1 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops if the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

## 8 passages — run 2 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

## 8 passages — run 3 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

## 8 passages — run 1 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 8 passages — run 2 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 8 passages — run 3 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## 8 passages — run 1 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Any rent increase is capped at the lower of the consumer price index or 4% [1].

## 8 passages — run 2 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Any rent increase is capped at the lower of the consumer price index or 4% [1].

## 8 passages — run 3 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Rent increases are capped at the lower of the consumer price index or 4% [1].

## 8 passages — run 1 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## 8 passages — run 2 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## 8 passages — run 3 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit must be registered with an approved protection scheme within 30 days of receipt [1][2].

## 8 passages — run 1 — How fast is a non-emergency repair attended?

Grounded: true · cites: false · declined: false

Non-emergency repairs are attended within 14 days.

## 8 passages — run 2 — How fast is a non-emergency repair attended?

Grounded: true · cites: false · declined: false

Non-emergency repairs are attended within 14 days.

## 8 passages — run 3 — How fast is a non-emergency repair attended?

Grounded: true · cites: false · declined: false

Non-emergency repairs are attended within 14 days.

## 8 passages — run 1 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying more than 14 consecutive nights require notification [2].

## 8 passages — run 2 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying more than 14 consecutive nights require notification [2].

## 8 passages — run 3 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying more than 14 consecutive nights require notification [2].

## 8 passages — run 1 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 8 passages — run 2 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## 8 passages — run 3 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The additional deposit for a pet is one week's rent [1].

## 8 passages — run 1 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

To end the tenancy, the tenant must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

## 8 passages — run 2 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

To end the tenancy after the fixed term, the tenant must give one month's notice ending on a rent payment date [1].

## 8 passages — run 3 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

After the fixed term, the tenant must give one month's notice ending on a rent payment date [1].

## 8 passages — run 1 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

## 8 passages — run 2 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits is 25% of the monthly fee in any calendar month [1].

## 8 passages — run 3 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

## Oracle — run 1 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

For Severity 1 issues (such as when everything is down), the first response target is 30 minutes from ticket creation [1].

## Oracle — run 2 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: true · declined: false

The first response target for Severity 1 (which applies when everything is down) is 30 minutes from ticket creation, measured from the time the ticket is created rather than from the start of business hours [1].

## Oracle — run 3 — How quickly does someone get back to me if everything is down?

Grounded: true · cites: false · declined: true

The documents do not cover response times for "everything is down" specifically, but they cover first response targets measured from ticket creation for different severity levels: 30 minutes for Severity 1, two hours for Severity 2, one business day for Severity 3, and three business days for Severity 4 [1].

## Oracle — run 1 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything you send is deleted from the ticket system 90 days after closure [1].

## Oracle — run 2 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything you send is deleted from the ticket system 90 days after closure [1].

## Oracle — run 3 — How long do you keep whatever I attach to a ticket?

Grounded: true · cites: true · declined: false

Anything you send is deleted from the ticket system 90 days after closure [1].

## Oracle — run 1 — How much warning do I need to give before it renews?

Grounded: true · cites: false · declined: true

The documents do not cover how much warning you need to give before a plan renews, though they state that support plans renew annually unless cancelled 30 days before the renewal date [1].

## Oracle — run 2 — How much warning do I need to give before it renews?

Grounded: true · cites: false · declined: true

The documents do not cover renewal notice periods for anything other than support plans, which require cancellation 30 days before the renewal date [1].

## Oracle — run 3 — How much warning do I need to give before it renews?

Grounded: true · cites: true · declined: false

You need to cancel 30 days before the renewal date [1].

## Oracle — run 1 — What do I get back if you miss a target?

Grounded: true · cites: false · declined: true

The documents do not cover refunds or general remedies beyond Premier plan service credits. For a missed first response target on a Premier plan, you receive service credits of 5% of the monthly fee per missed target, up to a maximum of 25% in any calendar month [1]. Standard plans do not receive service credits [1].

## Oracle — run 2 — What do I get back if you miss a target?

Grounded: true · cites: false · declined: true

The documents do not cover refunds or general remedies for a missed target other than for Premier plans. For Premier plans, missing a first response target credits 5% of the monthly fee per missed target, capped at 25% in any calendar month, which are applied automatically to the next invoice [1]. Standard plans carry no service credits [1].

## Oracle — run 3 — What do I get back if you miss a target?

Grounded: true · cites: false · declined: true

The documents do not cover refunds or what you get back for standard plans, but for a Premier plan, missing a first response target credits 5% of the monthly fee per missed target, capped at 25% in any calendar month [1]. Credits are the only remedy and cannot be exchanged for a refund [1].

## Oracle — run 1 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

The documents state that emergency repairs are attended within 24 hours, and an emergency includes the loss of heat in winter [1].

## Oracle — run 2 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

An emergency repair, such as a loss of heat in winter, is attended within 24 hours [1].

## Oracle — run 3 — The boiler died in January. How fast should someone come?

Grounded: true · cites: true · declined: false

An emergency repair, such as a loss of heat in winter, is attended within 24 hours [1].

## Oracle — run 1 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

The tenant gives one month's notice ending on a rent payment date [1].

## Oracle — run 2 — How much notice do I give to move out?

Grounded: false · cites: false · declined: true

The documents do not cover moving out generally, but they do cover ending the tenancy after the fixed term: the tenant must give one month's notice ending on a rent payment date.

## Oracle — run 3 — How much notice do I give to move out?

Grounded: false · cites: true · declined: false

After the fixed term, you give one month's notice ending on a rent payment date [1].

## Oracle — run 1 — How much do I have to hand over at the start?

Grounded: true · cites: false · declined: true

The documents do not cover the total amount you have to hand over at the start, though they do state that the deposit is five weeks' rent [1].

## Oracle — run 2 — How much do I have to hand over at the start?

Grounded: true · cites: false · declined: true

The documents do not cover the total amount to be handed over at the start, though they do state that the deposit is five weeks' rent [1].

## Oracle — run 3 — How much do I have to hand over at the start?

Grounded: true · cites: false · declined: true

The documents do not cover the total amount to hand over at the start, but they do state that the deposit is five weeks' rent [1].

## Oracle — run 1 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## Oracle — run 2 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## Oracle — run 3 — What hours is the standard plan covered?

Grounded: true · cites: true · declined: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## Oracle — run 1 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## Oracle — run 2 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## Oracle — run 3 — How much force does the press develop?

Grounded: true · cites: true · declined: false

The press develops 90 kilonewtons [1].

## Oracle — run 1 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

At one metre, the press itself measures 84 dB [1].

## Oracle — run 2 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

At one metre, the press itself measures 84 dB [1].

## Oracle — run 3 — How loud is it at a metre?

Grounded: true · cites: true · declined: false

At one metre, the press itself measures 84 dB [1].

## Oracle — run 1 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

ISO VG 46 mineral oil goes in it [1].

## Oracle — run 2 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

ISO VG 46 mineral oil goes in it [1].

## Oracle — run 3 — Which oil grade goes in it?

Grounded: true · cites: true · declined: false

The documents specify using ISO VG 46 mineral oil [1].

## Oracle — run 1 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [1].

## Oracle — run 2 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [1].

## Oracle — run 3 — How often does the oil need changing?

Grounded: true · cites: true · declined: false

The documents cover hydraulic oil requirements and state that the oil needs to be changed every 2,000 operating hours or annually, whichever comes first [1].

## Oracle — run 1 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

Oil temperatures above 70°C shorten seal life sharply [1].

## Oracle — run 2 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

Oil temperatures above 70°C are too hot, as they sharply shorten seal life [1].

## Oracle — run 3 — What oil temperature is too hot?

Grounded: true · cites: true · declined: false

Oil temperatures above 70°C are too hot, as this sharply shortens seal life [1].

## Oracle — run 1 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

Dies are held by four M16 bolts torqued to 210 Nm [1].

## Oracle — run 2 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

The die bolts take a torque of 210 Nm [1].

## Oracle — run 3 — What torque do the die bolts take?

Grounded: true · cites: true · declined: false

The die bolts are torqued to 210 Nm [1].

## Oracle — run 1 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die that has been reground below 38 mm thickness must not be refitted [1].

## Oracle — run 2 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

The documents state that a die reground below 38 mm thickness must not be refitted [1].

## Oracle — run 3 — How thin can a die be reground before it is scrap?

Grounded: true · cites: true · declined: false

A die must not be refitted if it has been reground below 38 mm in thickness [1].

## Oracle — run 1 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops when the two sensors differ by more than 5 bar [1].

## Oracle — run 2 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops when the two sensors differ by more than 5 bar [1].

## Oracle — run 3 — How far apart can the pressure sensors read before it stops?

Grounded: true · cites: true · declined: false

The press stops when the two pressure sensors differ by more than 5 bar [1].

## Oracle — run 1 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## Oracle — run 2 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## Oracle — run 3 — What humidity needs a desiccant in storage?

Grounded: true · cites: true · declined: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## Oracle — run 1 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

Any rent increase is capped at the lower of the consumer price index or 4% [1].

## Oracle — run 2 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

The documents state that any rent increase is capped at the lower of the consumer price index or 4% [1].

## Oracle — run 3 — How much can the rent go up by?

Grounded: true · cites: true · declined: false

The documents state that any rent increase is capped at the lower of the consumer price index or 4% [1].

## Oracle — run 1 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1].

## Oracle — run 2 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1].

## Oracle — run 3 — How long does the deposit take to be protected?

Grounded: true · cites: true · declined: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1].

## Oracle — run 1 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1].

## Oracle — run 2 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1].

## Oracle — run 3 — How fast is a non-emergency repair attended?

Grounded: true · cites: true · declined: false

Non-emergency repairs are attended within 14 days [1].

## Oracle — run 1 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying more than 14 consecutive nights require notification [1].

## Oracle — run 2 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying more than 14 consecutive nights require notification [1].

## Oracle — run 3 — How long can a guest stay before I have to tell anyone?

Grounded: true · cites: true · declined: false

Guests staying more than 14 consecutive nights require notification [1].

## Oracle — run 1 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## Oracle — run 2 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## Oracle — run 3 — How much is the extra deposit for a pet?

Grounded: true · cites: true · declined: false

The extra deposit for a pet is one week's rent [1].

## Oracle — run 1 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

The documents cover the rules for ending a tenancy: the tenant must give one month's notice ending on a rent payment date, and the notice must be in writing [1].

## Oracle — run 2 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

If you are leaving, the tenant gives one month's notice ending on a rent payment date [1].

## Oracle — run 3 — How much notice do I give if I am leaving?

Grounded: true · cites: true · declined: false

If you are the tenant, you give one month's notice ending on a rent payment date [1].

## Oracle — run 1 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

## Oracle — run 2 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

## Oracle — run 3 — What is the cap on credits in a month?

Grounded: true · cites: true · declined: false

The cap on credits in any calendar month is 25% of the monthly fee [1].
