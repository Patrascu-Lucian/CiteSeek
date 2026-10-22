# What Gemini answers mid-conversation

Run 2026-10-22 by `pnpm eval:answers --conversation`: each of the 24
questions in `ANSWER_SET` asked second, after a turn about another document
(topic change) and after one about the same document (same topic), and asked
alone, all in one session. The earlier turn is answered once, with the shipped
wording, and each wording answers the second turn on that same history. History
goes through the chat route's `convertToModelMessages`, and retrieval follows
its order, the rewrite included. 3 runs; a question's result is the majority
of them.

`read as a refusal` is a right answer the page unlinks: grounded, opening in a
declining form, and carrying markers (ADR 058). The 1.11.0 exit check met one,
the credit cap asked after the press. `earlier document in view` counts second
turns that retrieved a passage from the earlier turn's document.

| condition | wording | grounded | grounded per run | cites | cites per run | declined | read as a refusal | read as a refusal per run | earlier document in view per run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| alone | rule 7 as of v1.11.0 | 24/24 | 24, 24, 24 | 23/24 | 23, 23, 23 | 0/24 | 0/24 | 0, 0, 0 | — |
| alone | rule 7 + the earlier-turns sentence (ADR 061) | 24/24 | 24, 24, 24 | 24/24 | 24, 23, 23 | 0/24 | 0/24 | 0, 1, 0 | — |
| topic change | rule 7 as of v1.11.0 | 24/24 | 24, 24, 24 | 20/24 | 18, 19, 19 | 3/24 | 2/24 | 5, 3, 3 | 4, 4, 4 |
| topic change | rule 7 + the earlier-turns sentence (ADR 061) | 24/24 | 24, 24, 24 | 20/24 | 16, 19, 18 | 4/24 | 3/24 | 7, 4, 6 | 4, 4, 4 |
| same topic | rule 7 as of v1.11.0 | 24/24 | 24, 24, 24 | 21/24 | 20, 23, 19 | 2/24 | 2/24 | 3, 0, 4 | — |
| same topic | rule 7 + the earlier-turns sentence (ADR 061) | 24/24 | 24, 23, 24 | 20/24 | 21, 20, 19 | 4/24 | 3/24 | 3, 3, 5 | — |

## The gate, by the rule committed before this run (ADR 061)

rule 7 as of v1.11.0, read as a refusal after a topic change or a same-topic
turn, or later in the exit check's sequence: 8, 4, 7 of 50 per run.

## The comparison, by the rule committed before this run (ADR 061)

The earlier-turns sentence replaces the shipped wording only if no question
gets worse on any outcome in any condition, and at least one gets better.

**keep.**

- alone: grounded: gained none; lost none
- alone: cites: gained "How fast is a non-emergency repair attended?"; lost none
- alone: not read as a refusal: gained none; lost none
- topic change: grounded: gained none; lost none
- topic change: cites: gained "How fast is a non-emergency repair attended?", "What is the cap on credits in a month?"; lost "What do I get back if you miss a target?", "How often does the oil need changing?"
- topic change: not read as a refusal: gained "How much notice do I give if I am leaving?", "What is the cap on credits in a month?"; lost "How much warning do I need to give before it renews?", "What do I get back if you miss a target?", "How often does the oil need changing?"
- same topic: grounded: gained none; lost none
- same topic: cites: gained "What hours is the standard plan covered?"; lost "How much do I have to hand over at the start?", "What humidity needs a desiccant in storage?"
- same topic: not read as a refusal: gained none; lost "How much do I have to hand over at the start?"
- follow-up: cites: gained none; lost "and the filter?"
- follow-up: not declined: gained none; lost "and the filter?"

## Per question

| question | alone, shipped | alone, candidate | topic change, shipped | topic change, candidate | same topic, shipped | same topic, candidate |
| --- | --- | --- | --- | --- | --- | --- |
| How quickly does someone get back to me if everything is down? | yes | yes | yes | yes | yes | yes |
| How long do you keep whatever I attach to a ticket? | yes | yes | yes | yes | yes | yes |
| How much warning do I need to give before it renews? | yes | yes | uncited | **read as a refusal** | **read as a refusal** | **read as a refusal** |
| What do I get back if you miss a target? | yes | yes | yes | **read as a refusal** | yes | yes |
| The boiler died in January. How fast should someone come? | yes | yes | yes | yes | yes | yes |
| How much notice do I give to move out? | yes | yes | yes | yes | yes | yes |
| How much do I have to hand over at the start? | yes | yes | yes | yes | yes | **read as a refusal** |
| What hours is the standard plan covered? | yes | yes | yes | yes | uncited | yes |
| How much force does the press develop? | yes | yes | yes | yes | yes | yes |
| How loud is it at a metre? | yes | yes | yes | yes | yes | yes |
| Which oil grade goes in it? | yes | yes | yes | yes | yes | yes |
| How often does the oil need changing? | yes | yes | yes | **read as a refusal** | yes | yes |
| What oil temperature is too hot? | yes | yes | yes | yes | yes | yes |
| What torque do the die bolts take? | yes | yes | yes | yes | yes | yes |
| How thin can a die be reground before it is scrap? | yes | yes | yes | yes | yes | yes |
| How far apart can the pressure sensors read before it stops? | yes | yes | yes | yes | yes | yes |
| What humidity needs a desiccant in storage? | yes | yes | yes | yes | yes | uncited |
| How much can the rent go up by? | yes | yes | yes | yes | yes | yes |
| How long does the deposit take to be protected? | yes | yes | yes | yes | yes | yes |
| How fast is a non-emergency repair attended? | uncited | yes | uncited | yes | yes | yes |
| How long can a guest stay before I have to tell anyone? | yes | yes | yes | yes | yes | yes |
| How much is the extra deposit for a pet? | yes | yes | yes | yes | yes | yes |
| How much notice do I give if I am leaving? | yes | yes | **read as a refusal** | uncited | yes | yes |
| What is the cap on credits in a month? | yes | yes | **read as a refusal** | yes | **read as a refusal** | **read as a refusal** |

## Follow-ups

Each `FOLLOW_UP_SET` case asked after its context turn, which is answered once
with the shipped wording. A follow-up names no value to ground against, so it
is scored on citing the passage it needs and on declining. One that retrieves
nothing alone is rewritten from the history first, as the route does.

| wording | cites | cites per run | declined | declined per run |
| --- | --- | --- | --- | --- |
| rule 7 as of v1.11.0 | 9/10 | 7, 9, 8 | 1/10 | 3, 1, 2 |
| rule 7 + the earlier-turns sentence (ADR 061) | 8/10 | 7, 8, 7 | 2/10 | 2, 2, 2 |

| follow-up | shipped | candidate |
| --- | --- | --- |
| and the fault code? | yes | yes |
| on premier? | yes | yes |
| how often? | yes | yes |
| and the filter? | yes | **declined** |
| what about the deposit? | yes | yes |
| in writing? | yes | yes |
| how much is it? | yes | yes |
| why? | yes | yes |
| who handles it then? | yes | yes |
| and outside them? | **declined** | **declined** |

## Sequences

Asked in order in one conversation. The first turn is answered once with the
shipped wording, and each wording goes on from it with its own replies. The
exit check's is the 1.11.0 sequence on the fixtures; the demo's starters are
asked of the handbook alone, where nothing says what the right answer is, so
they show only whether the page unlinked a reply.

### the 1.11.0 exit check

| turn | wording | run 1 | run 2 | run 3 |
| --- | --- | --- | --- | --- |
| What is the cap on credits in a month? | shipped | **unlinked** | **read as a refusal** | answered |
| What is the cap on credits in a month? | candidate | **read as a refusal** | answered | **read as a refusal** |
| How long does the deposit take to be protected? | shipped | answered | answered | answered |
| How long does the deposit take to be protected? | candidate | answered | answered | answered |

### the demo's starter questions

| turn | wording | run 1 | run 2 | run 3 |
| --- | --- | --- | --- | --- |
| How many hours a day do I have to overlap with my team? | shipped | answered | answered | answered |
| How many hours a day do I have to overlap with my team? | candidate | answered | answered | answered |
| Can I put company documents in my personal cloud storage? | shipped | **unlinked** | **unlinked** | **unlinked** |
| Can I put company documents in my personal cloud storage? | candidate | **unlinked** | **unlinked** | **unlinked** |

## Run 1 — alone — How quickly does someone get back to me if everything is down?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

For a Severity 1 issue (when a production system is unavailable to all users), the first response target is 30 minutes, measured from ticket creation [3][4]. 

However, if you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes [1]. Premier plans are covered continuously, including weekends and holidays [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

When a production system is unavailable to all users (Severity 1), the first response target is 30 minutes from ticket creation [3][4]. 

However, if you are on a Standard plan and raise the ticket outside of coverage hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes [1]. Premier plans are covered continuously [1].

## Run 1 — topic change — How quickly does someone get back to me if everything is down?

Earlier: What oil temperature is too hot?

> An oil temperature above 70°C shortens seal life sharply [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

For Severity 1 tickets (where a production system is unavailable to all users), the first response target is 30 minutes, measured from ticket creation [3][4]. 

If you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the clock does not run overnight; the ticket is queued and begins its 30-minute clock when coverage resumes [1]. If you are on a Premier plan, coverage is continuous, including weekends and holidays [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover oil temperatures, but regarding support response times, the first response target is 30 minutes for Severity 1 tickets (which means a production system is unavailable to all users) [3][4].

## Run 1 — same topic — How quickly does someone get back to me if everything is down?

Earlier: How long do you keep whatever I attach to a ticket?

> Anything a customer sends is deleted from the ticket system 90 days after closure [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

When a production system is unavailable to all users, it is classified as Severity 1 [4]. The first response target for a Severity 1 ticket is 30 minutes, measured from ticket creation [3]. 

If you are on a Standard plan and raise a Severity 1 ticket outside of coverage hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and its 30-minute clock begins when coverage resumes [1]. If you are on a Premier plan, coverage is continuous, including weekends and holidays [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

For a Severity 1 ticket—meaning a production system is unavailable to all users—the first response target is 30 minutes from ticket creation [3][4]. 

However, if you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and its 30-minute clock does not begin until coverage resumes [1]. If you are on a Premier plan, coverage is continuous, including weekends and holidays [1].

## Run 1 — alone — How long do you keep whatever I attach to a ticket?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything a customer sends is deleted from the ticket system 90 days after closure [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything you send is deleted from the ticket system 90 days after closure [1].

## Run 1 — topic change — How long do you keep whatever I attach to a ticket?

Earlier: What torque do the die bolts take?

> The four M16 bolts holding the dies are torqued to 210 Nm in a diagonal sequence [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything a customer sends is deleted from the ticket system 90 days after closure [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything you send is deleted from the ticket system 90 days after closure [1].

## Run 1 — same topic — How long do you keep whatever I attach to a ticket?

Earlier: How much warning do I need to give before it renews?

> You need to give 30 days' notice before the renewal date to cancel a support plan [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything you send is deleted from the ticket system 90 days after closure [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything you send is deleted from the ticket system 90 days after closure [1].

## Run 1 — alone — How much warning do I need to give before it renews?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

You need to give 30 days' notice before the renewal date to cancel a Meridian support plan [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

You need to give 30 days' notice before the renewal date to cancel a support plan [1].

## Run 1 — topic change — How much warning do I need to give before it renews?

Earlier: How thin can a die be reground before it is scrap?

> A die must not be reground below 38 mm thickness [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover contract or subscription renewals generally, but for support plans, they must be cancelled 30 days before the renewal date [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much warning you need to give before a tenancy or support plan renews, except that support plans renew automatically unless cancelled 30 days before the renewal date [1].

## Run 1 — same topic — How much warning do I need to give before it renews?

Earlier: What do I get back if you miss a target?

> If a first response target is missed on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, up to a maximum of 25% in any calendar month [2]. Standard plans do not receive service credits [2]. 
> 
> These credits are applied automatically to your next invoice and do not need to be claimed [2]. They serve as the sole remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [1][2].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much warning you need to give before a tenancy renews. They do cover support plans, which renew annually unless cancelled 30 days before the renewal date [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much warning you need to give before a tenancy renews, though they do state that support plans renew annually unless cancelled 30 days before the renewal date [1].

## Run 1 — alone — What do I get back if you miss a target?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

On a Premier plan, missing a first response target credits 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 

These credits are applied automatically to the next invoice and do not require you to claim them [2]. They serve as the only remedy for a missed target, are not a refund, and cannot be exchanged for one [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

If a Premier plan misses a first response target, you receive a credit of 5% of the monthly fee per missed target, up to a maximum cap of 25% in any calendar month [2]. These credits are applied automatically to your next invoice and do not need to be claimed [2]. 

Standard plans do not receive service credits [2]. Credits are considered the only remedy for a missed target, and they cannot be exchanged for a refund [1][2].

## Run 1 — topic change — What do I get back if you miss a target?

Earlier: How far apart can the pressure sensors read before it stops?

> The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

For missing a first response target on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, up to a maximum cap of 25% in any calendar month [2]. Standard plans do not receive service credits [2]. 

These credits are applied automatically to your next invoice and do not need to be claimed [2]. They serve as the sole remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover refunds or compensation for missed targets other than service credits. For Premier plans, missing a first response target credits 5% of the monthly fee per missed target, capped at 25% in any calendar month, while Standard plans carry no service credits [2]. These credits are applied automatically to the next invoice, are the only remedy for a missed target, and cannot be exchanged for a refund [2].

## Run 1 — same topic — What do I get back if you miss a target?

Earlier: What hours is the standard plan covered?

> Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Missing a first response target on a Premier plan credits 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 

These credits are applied automatically to the next invoice and do not require you to claim them [2]. They serve as the only remedy for a missed target; they are not a refund and cannot be exchanged for one [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Missing a first response target on a Premier plan credits 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. These credits are the only remedy for a missed target, are applied automatically to the next invoice without requiring a claim, and cannot be exchanged for a refund [2].

## Run 1 — alone — The boiler died in January. How fast should someone come?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Emergency repairs are attended within 24 hours [1]. An emergency includes the loss of heat in winter [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Emergency repairs are attended within 24 hours, and loss of heat in winter is considered an emergency [1].

## Run 1 — topic change — The boiler died in January. How fast should someone come?

Earlier: How quickly does someone get back to me if everything is down?

> The first response target for Severity 1 tickets (meaning a production system is unavailable to all users) is 30 minutes, measured from ticket creation [3][4]. 
> 
> However, if you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and its 30-minute clock does not begin until coverage resumes [1]. Premier plans, by contrast, are covered continuously [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover boiler repairs specifically; they cover emergency repairs, which are attended within 24 hours [1]. An emergency is defined as a loss of heat in winter, loss of water, an unsecured entrance, or anything presenting a risk to health [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

A loss of heat in winter is classified as an emergency repair, which will be attended to within 24 hours [1].

## Run 1 — same topic — The boiler died in January. How fast should someone come?

Earlier: How much notice do I give to move out?

> After the fixed term, the tenancy continues monthly, and you must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Emergency repairs are attended within 24 hours [1]. A loss of heat in winter is considered an emergency [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Loss of heat in winter is considered an emergency repair and will be attended to within 24 hours [1]. If the landlord cannot be reached within four hours, you may arrange the emergency repair yourself and recover the reasonable cost against the rent, provided you produce the invoice [1].

## Run 1 — alone — How much notice do I give to move out?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

After the fixed term, the tenant must give one month's notice ending on a rent payment date [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

To end the tenancy after the fixed term, you must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

## Run 1 — topic change — How much notice do I give to move out?

Earlier: How long do you keep whatever I attach to a ticket?

> Anything a customer sends is deleted from the ticket system 90 days after closure [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The tenant must give one month's notice, which must end on a rent payment date [1]. The notice must be in writing [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The documents cover ending the tenancy, stating that the tenant must give one month's notice ending on a rent payment date, and the landlord must give two months' notice [1].

## Run 1 — same topic — How much notice do I give to move out?

Earlier: How much do I have to hand over at the start?

> At the start of the tenancy, you must pay:
> 
> * **Rent:** Rent is payable monthly in advance on the first day of each month [4].
> * **Deposit:** The deposit is five weeks' rent [1].
> * **Additional deposit (if applicable):** If you have a pet (one cat or one dog in a property with private outdoor space), written consent carries an additional deposit of one week's rent [3].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

To end the tenancy after the fixed term, you must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

After the fixed term, you must give one month's notice, which must end on a rent payment date and be in writing [1].

## Run 1 — alone — How much do I have to hand over at the start?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

At the start of the tenancy, you must hand over:

* Rent payable monthly in advance on the first day of each month [4].
* A deposit equal to five weeks' rent [1].
* An additional deposit of one week's rent if you have written consent for a pet in a property with private outdoor space [3].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

At the start of the tenancy, you must pay:

* Rent payable monthly in advance on the first day of each month [4].
* A deposit equal to five weeks' rent [1]. 
* If you have a pet (one cat or one dog in a property with private outdoor space), there is an additional deposit of one week's rent [3].

## Run 1 — topic change — How much do I have to hand over at the start?

Earlier: How much warning do I need to give before it renews?

> You need to give 30 days' notice before the renewal date to cancel a Meridian support plan [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is five weeks' rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is five weeks' rent [1]. Additionally, if you have a pet (one cat or one dog in a property with private outdoor space), keeping it requires written consent that carries an additional deposit of one week's rent [3].

## Run 1 — same topic — How much do I have to hand over at the start?

Earlier: How much can the rent go up by?

> Rent increases are capped at the lower of the consumer price index or 4% [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The documents cover the rent payment terms and the deposit amount, which is five weeks' rent [1][4]. However, they do not cover any other upfront costs that may be required at the start.

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover the total amount needed at the start, though they state that the deposit is five weeks' rent [1].

## Run 1 — alone — What hours is the standard plan covered?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## Run 1 — topic change — What hours is the standard plan covered?

Earlier: What humidity needs a desiccant in storage?

> Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## Run 1 — same topic — What hours is the standard plan covered?

Earlier: What is the cap on credits in a month?

> The cap on credits in any calendar month is 25% of the monthly fee [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country.

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## Run 1 — alone — How much force does the press develop?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

## Run 1 — topic change — How much force does the press develop?

Earlier: The boiler died in January. How fast should someone come?

> The documents cover tenancy repairs and support policy, and specifically state that emergency repairs are attended within 24 hours [1]. An emergency includes the loss of heat in winter [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

## Run 1 — same topic — How much force does the press develop?

Earlier: How loud is it at a metre?

> At one metre, the press itself measures 84 dB [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

## Run 1 — alone — How loud is it at a metre?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

At one metre, the press itself measures 84 dB [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

At one metre, the press itself measures 84 dB [1].

## Run 1 — topic change — How loud is it at a metre?

Earlier: How much notice do I give to move out?

> To end the tenancy after the fixed term, the tenant must give one month's notice ending on a rent payment date [1]. The notice must be in writing, as notices served by message or spoken in person have no effect [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press measures 84 dB at one metre [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press itself measures 84 dB at one metre [1].

## Run 1 — same topic — How loud is it at a metre?

Earlier: Which oil grade goes in it?

> The press uses ISO VG 46 mineral oil [1]. Synthetic alternatives are also compatible [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press itself measures 84 dB at one metre [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover the oil grade. They do cover that the press itself measures 84 dB at one metre [1].

## Run 1 — alone — Which oil grade goes in it?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press uses ISO VG 46 mineral oil [1]. Synthetic alternatives are also compatible [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Use ISO VG 46 mineral oil [1].

## Run 1 — topic change — Which oil grade goes in it?

Earlier: How much do I have to hand over at the start?

> At the start of the tenancy, you must pay:
> 
> * **Rent:** Rent is payable monthly in advance on the first day of each month [4].
> * **Deposit:** The deposit is five weeks' rent [1].
> * **Additional deposit (if applicable):** If you have written consent for a pet in a property with private outdoor space, there is an additional deposit of one week's rent [3].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The documents specify using ISO VG 46 mineral oil [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover oil grades generally, but for hydraulic oil they specify ISO VG 46 mineral oil [1].

## Run 1 — same topic — Which oil grade goes in it?

Earlier: How often does the oil need changing?

> The hydraulic oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The documents specify using ISO VG 46 mineral oil [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press uses ISO VG 46 mineral oil [1].

## Run 1 — alone — How often does the oil need changing?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The hydraulic oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

## Run 1 — topic change — How often does the oil need changing?

Earlier: How much can the rent go up by?

> Any rent increase is capped at the lower of the consumer price index or 4% [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how often the rent can go up. They cover hydraulic equipment maintenance, including instructions that the oil must be changed every 2,000 operating hours or annually, whichever comes first [2].

## Run 1 — same topic — How often does the oil need changing?

Earlier: What oil temperature is too hot?

> An oil temperature above 70°C shortens seal life sharply [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Change the hydraulic oil every 2,000 operating hours or annually, whichever comes first [2].

## Run 1 — alone — What oil temperature is too hot?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

An oil temperature above 70°C shortens seal life sharply [1]. Additionally, fault code E04 indicates an over-temperature condition [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Oil temperatures above 70°C shorten seal life sharply [1].

## Run 1 — topic change — What oil temperature is too hot?

Earlier: How long does the deposit take to be protected?

> The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Oil temperature above 70°C is too hot, as it sharply shortens seal life [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Oil temperatures above 70°C shorten seal life sharply [1].

## Run 1 — same topic — What oil temperature is too hot?

Earlier: What torque do the die bolts take?

> The die bolts are torqued to 210 Nm in a diagonal sequence [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Oil temperature above 70°C shortens seal life sharply [1]. Additionally, fault code E04 indicates over-temperature when the oil is too hot [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Oil temperatures above 70°C shorten seal life sharply [1]. Additionally, an oil temperature over-temperature triggers fault code E04, which latches until the oil falls below 60°C [2].

## Run 1 — alone — What torque do the die bolts take?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

## Run 1 — topic change — What torque do the die bolts take?

Earlier: How fast is a non-emergency repair attended?

> Non-emergency repairs are attended within 14 days [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

## Run 1 — same topic — What torque do the die bolts take?

Earlier: How thin can a die be reground before it is scrap?

> A die must not be reground below 38 mm thickness [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm [2].

## Run 1 — alone — How thin can a die be reground before it is scrap?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

A die must not be refitted if it has been reground below 38 mm in thickness [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

A die that has been reground below 38 mm thickness must not be refitted [1].

## Run 1 — topic change — How thin can a die be reground before it is scrap?

Earlier: How long can a guest stay before I have to tell anyone?

> Guests staying more than 14 consecutive nights require notification [2].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how long a guest can stay. They do cover equipment maintenance, specifically stating that a die reground below 38 mm thickness must not be refitted [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how thin a die can be reground before it is scrap, but they do state that a die reground below 38 mm thickness must not be refitted [1].

## Run 1 — same topic — How thin can a die be reground before it is scrap?

Earlier: How far apart can the pressure sensors read before it stops?

> The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how far apart pressure sensors can read, but they do cover die thickness limits: a die that has been reground below 38 mm thickness must not be refitted because the clamping geometry assumes a minimum stack height and a thin die shifts the load onto the bolts rather than the seating face [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

A die that has been reground below 38 mm thickness must not be refitted [1].

## Run 1 — alone — How far apart can the pressure sensors read before it stops?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

## Run 1 — topic change — How far apart can the pressure sensors read before it stops?

Earlier: How much is the extra deposit for a pet?

> The extra deposit for a pet is one week's rent [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops if the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops if the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

## Run 1 — same topic — How far apart can the pressure sensors read before it stops?

Earlier: What humidity needs a desiccant in storage?

> Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops if the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops if the two pressure sensors differ by more than 5 bar [1].

## Run 1 — alone — What humidity needs a desiccant in storage?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## Run 1 — topic change — What humidity needs a desiccant in storage?

Earlier: How much notice do I give if I am leaving?

> The tenant gives one month's notice ending on a rent payment date [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## Run 1 — same topic — What humidity needs a desiccant in storage?

Earlier: How much force does the press develop?

> The press develops 90 kilonewtons [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## Run 1 — alone — How much can the rent go up by?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Any rent increase is capped at the lower of the consumer price index or 4% [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The rent increase is capped at the lower of the consumer price index or 4% [1].

## Run 1 — topic change — How much can the rent go up by?

Earlier: What do I get back if you miss a target?

> If a first response target is missed on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, up to a maximum of 25% in any calendar month [2]. Standard plans do not receive service credits [2]. 
> 
> These credits are applied automatically to your next invoice and do not need to be claimed [2]. They are considered the sole remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Rent increases are capped at the lower of the consumer price index or 4%, and the increase requires two months' written notice [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Rent increases are capped at the lower of the consumer price index or 4% [1].

## Run 1 — same topic — How much can the rent go up by?

Earlier: How long does the deposit take to be protected?

> The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Rent increases are capped at the lower of the consumer price index or 4% [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The rent increase is capped at the lower of the consumer price index or 4% [1].

## Run 1 — alone — How long does the deposit take to be protected?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit must be registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## Run 1 — topic change — How long does the deposit take to be protected?

Earlier: What hours is the standard plan covered?

> Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover the standard plan or its hours; they cover the Larkfield tenancy agreement, including deposit protection rules [1][2][3]. 

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## Run 1 — same topic — How long does the deposit take to be protected?

Earlier: How fast is a non-emergency repair attended?

> Non-emergency repairs are attended within 14 days [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## Run 1 — alone — How fast is a non-emergency repair attended?

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days.

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days [1].

## Run 1 — topic change — How fast is a non-emergency repair attended?

Earlier: What is the cap on credits in a month?

> The cap on credits in any calendar month is 25% of the monthly fee [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days.

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days [1].

## Run 1 — same topic — How fast is a non-emergency repair attended?

Earlier: How long can a guest stay before I have to tell anyone?

> Guests staying more than 14 consecutive nights require notification [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days [1].

## Run 1 — alone — How long can a guest stay before I have to tell anyone?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

## Run 1 — topic change — How long can a guest stay before I have to tell anyone?

Earlier: How quickly does someone get back to me if everything is down?

> If everything is down, a support ticket is classified as Severity 1 (meaning a production system is unavailable to all users) [4]. The first response target for Severity 1 tickets is 30 minutes, measured from ticket creation rather than from the start of business hours [3]. 
> 
> However, coverage hours depend on your plan:
> * **Standard plans** are covered 09:00 to 18:00 in the customer's registered timezone, Monday to Friday (excluding public holidays) [1]. Severity 1 tickets raised outside of these coverage hours are queued, and the 30-minute clock begins when coverage resumes (it does not run overnight) [1].
> * **Premier plans** are covered continuously, including weekends and holidays [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying for more than 14 consecutive nights require notification, and staying for more than 28 nights constitutes occupation and requires consent [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

## Run 1 — same topic — How long can a guest stay before I have to tell anyone?

Earlier: How much is the extra deposit for a pet?

> The extra deposit for a pet is one week's rent [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

## Run 1 — alone — How much is the extra deposit for a pet?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

## Run 1 — topic change — How much is the extra deposit for a pet?

Earlier: How long do you keep whatever I attach to a ticket?

> Anything a customer sends is deleted from the ticket system 90 days after closure [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

## Run 1 — same topic — How much is the extra deposit for a pet?

Earlier: How much notice do I give if I am leaving?

> After the fixed term, the tenant must give one month's notice ending on a rent payment date [1]. Notice must be in writing, as notices served by message or spoken in person have no effect [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The additional deposit for a pet is one week's rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

## Run 1 — alone — How much notice do I give if I am leaving?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

To end the tenancy after the fixed term, you must give one month's notice ending on a rent payment date [1]. The notice must be in writing, as notices served by message or spoken in person have no effect [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The tenant gives one month's notice ending on a rent payment date [1].

## Run 1 — topic change — How much notice do I give if I am leaving?

Earlier: How much warning do I need to give before it renews?

> You need to give 30 days' notice before the renewal date to cancel a support plan [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover leaving a support plan beyond cancellation, but for ending the tenancy, the tenant must give one month's notice ending on a rent payment date, while the landlord must give two months' [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: false

The documents do not cover leaving an apartment or ending a tenancy other than the notice required by the landlord and tenant: the tenant gives one month's notice ending on a rent payment date, and the landlord gives two months'.

## Run 1 — same topic — How much notice do I give if I am leaving?

Earlier: The boiler died in January. How fast should someone come?

> The loss of heat in winter is considered an emergency repair, and emergency repairs are attended to within 24 hours [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

After the fixed term, the tenancy continues monthly, requiring the tenant to give one month's notice ending on a rent payment date [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The tenant must give one month's notice ending on a rent payment date [1]. Notice must be in writing [1].

## Run 1 — alone — What is the cap on credits in a month?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

## Run 1 — topic change — What is the cap on credits in a month?

Earlier: How much force does the press develop?

> The press develops 90 kilonewtons [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much force a press develops, but they do cover support plans, credits, and data handling; specifically, missing a first response target on a Premier plan is capped at 25% of the monthly fee in any calendar month [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The cap on credits in any calendar month is 25% [1].

## Run 1 — same topic — What is the cap on credits in a month?

Earlier: How quickly does someone get back to me if everything is down?

> The first response target for Severity 1 tickets (meaning a production system is unavailable to all users) is 30 minutes, measured from ticket creation [3][4]. 
> 
> However, if you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and its 30-minute clock does not begin until coverage resumes [1]. Premier plans, by contrast, are covered continuously [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover first response times for systems being down, but they do cover service credits for missing a first response target on a Premier plan [1]. The cap on credits is 25% of the monthly fee in any calendar month [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

## Run 2 — alone — How quickly does someone get back to me if everything is down?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

When a production system is unavailable to all users (Severity 1), the first response target is 30 minutes from ticket creation [3][4]. 

However, if you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute response clock does not begin until coverage resumes [1]. If you are on a Premier plan, coverage is continuous, including weekends and holidays [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

For a Severity 1 issue (where a production system is unavailable to all users), the first response target is 30 minutes from ticket creation [3][4]. 

However, if you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes [1]. Premier plans are covered continuously [1].

## Run 2 — topic change — How quickly does someone get back to me if everything is down?

Earlier: What oil temperature is too hot?

> Oil temperatures above 70°C shorten seal life sharply [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

For a Severity 1 ticket (when a production system is unavailable to all users), the first response target is 30 minutes measured from ticket creation [3][4]. 

However, if you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and its 30-minute clock begins only when coverage resumes [1]. Premier plans, by contrast, are covered continuously [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The first response target for Severity 1 tickets (when a production system is unavailable to all users) is 30 minutes from ticket creation [3][4]. 

However, if you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes [1]. Premier plans have continuous coverage, including weekends and holidays [1].

## Run 2 — same topic — How quickly does someone get back to me if everything is down?

Earlier: How long do you keep whatever I attach to a ticket?

> Anything sent to the ticket system is deleted 90 days after ticket closure [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

For a Severity 1 ticket (meaning a production system is unavailable to all users), the first response target is 30 minutes from ticket creation [3][4]. 

However, if you are on a Standard plan and raise a Severity 1 ticket outside covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and its 30-minute clock does not begin until coverage resumes [1]. Premier plans feature continuous coverage, including weekends and holidays [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The first response target for Severity 1 (when a production system is unavailable to all users) is 30 minutes from ticket creation [3][4]. 

However, if you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and its 30-minute clock does not begin until coverage resumes [1]. Premier plans are covered continuously [1].

## Run 2 — alone — How long do you keep whatever I attach to a ticket?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything sent to the ticket system is deleted 90 days after ticket closure [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything a customer sends is deleted from the ticket system 90 days after closure [1].

## Run 2 — topic change — How long do you keep whatever I attach to a ticket?

Earlier: What torque do the die bolts take?

> The four M16 die bolts are torqued to 210 Nm in a diagonal sequence [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything sent to the ticket system is deleted 90 days after the ticket is closed [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything a customer sends is deleted from the ticket system 90 days after closure [1].

## Run 2 — same topic — How long do you keep whatever I attach to a ticket?

Earlier: How much warning do I need to give before it renews?

> You need to give 30 days' notice before the renewal date to cancel a support plan [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything sent by a customer is deleted from the ticket system 90 days after the ticket is closed [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything you send is deleted from the ticket system 90 days after closure [1].

## Run 2 — alone — How much warning do I need to give before it renews?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

You need to give 30 days' notice before the renewal date to cancel a support plan [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover renewal warnings for a tenancy agreement, but for a Meridian support plan, cancellation requires 30 days' notice before the renewal date [1].

## Run 2 — topic change — How much warning do I need to give before it renews?

Earlier: How thin can a die be reground before it is scrap?

> A die must not be refitted if it has been reground below 38 mm in thickness [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Support plans renew annually unless cancelled 30 days before the renewal date [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much warning is needed before a tenancy renews, but they do cover support plans, which renew annually unless cancelled 30 days before the renewal date [1].

## Run 2 — same topic — How much warning do I need to give before it renews?

Earlier: What do I get back if you miss a target?

> If a first response target is missed on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 
> 
> These credits are applied automatically to the next invoice without requiring a claim [2]. They serve as the only remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [1][2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Support plans renew annually unless cancelled 30 days before the renewal date [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Support plans renew annually and require cancellation notice 30 days before the renewal date [1].

## Run 2 — alone — What do I get back if you miss a target?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

If a first response target is missed on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, up to a maximum cap of 25% in any calendar month [2]. These credits are applied automatically to your next invoice without needing to be claimed [2]. 

Standard plans do not carry service credits [2]. Note that these credits serve as the sole remedy for a missed target, and they cannot be exchanged for a refund [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

If you miss a first response target on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, up to a maximum cap of 25% in any calendar month [2]. Standard plans do not carry service credits [2]. 

These credits are applied automatically to your next invoice without requiring you to claim them [2]. They serve as the only remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [1][2].

## Run 2 — topic change — What do I get back if you miss a target?

Earlier: How far apart can the pressure sensors read before it stops?

> The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

If a first response target is missed on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. These credits are applied automatically to the next invoice [2]. 

Standard plans carry no service credits [2]. Credits serve as the only remedy for a missed target, and they cannot be exchanged for a refund [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover what you get back for missing a target in general, but they do state that for Premier plans, missing a first response target results in a credit of 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. These credits are applied automatically to the next invoice and are the only remedy for a missed target; they are not a refund and cannot be exchanged for one [1][2].

## Run 2 — same topic — What do I get back if you miss a target?

Earlier: What hours is the standard plan covered?

> Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Missing a first response target on a Premier plan credits 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 

These credits are applied automatically to the next invoice and do not require you to claim them [2]. They serve as the only remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

For a Premier plan, missing a first response target credits 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. These credits are applied automatically to the next invoice and do not require you to claim them [2]. They are the only remedy for a missed target, and they are not a refund and cannot be exchanged for one [2].

## Run 2 — alone — The boiler died in January. How fast should someone come?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Emergency repairs are attended within 24 hours, and an emergency includes the loss of heat in winter [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Emergency repairs are attended within 24 hours [1]. A loss of heat in winter is classified as an emergency [1].

## Run 2 — topic change — The boiler died in January. How fast should someone come?

Earlier: How quickly does someone get back to me if everything is down?

> When a production system is unavailable to all users (Severity 1), the first response target is 30 minutes from ticket creation [3][4]. 
> 
> However, if you are on a Standard plan and raise the ticket outside covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes [1]. Premier plans are covered continuously [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

A loss of heat in winter is considered an emergency repair, which will be attended within 24 hours [1]. 

If the landlord cannot be reached within four hours, you may arrange the emergency repair yourself and recover the reasonable cost against your rent, provided you produce the invoice [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Loss of heat in winter is classified as an emergency, and emergency repairs are attended within 24 hours [1]. 

If the landlord cannot be reached within four hours, you may arrange the emergency repair yourself and recover the reasonable cost against the rent, provided you produce the invoice [1].

## Run 2 — same topic — The boiler died in January. How fast should someone come?

Earlier: How much notice do I give to move out?

> After the fixed term, the tenant must give one month's notice ending on a rent payment date [1]. Notice must be in writing, as notices served by message or spoken in person have no effect [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Emergency repairs are attended within 24 hours [1]. An emergency includes the loss of heat in winter [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Emergency repairs are attended within 24 hours, and an emergency includes the loss of heat in winter [1].

## Run 2 — alone — How much notice do I give to move out?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

To end the tenancy after the fixed term, you must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The tenant gives one month's notice ending on a rent payment date [1].

## Run 2 — topic change — How much notice do I give to move out?

Earlier: How long do you keep whatever I attach to a ticket?

> Anything a customer sends is deleted from the ticket system 90 days after closure [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

To end the tenancy after the fixed term, the tenant must give one month's notice ending on a rent payment date, while the landlord must give two months' notice [1]. All notices must be in writing [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how long a tenant must stay or what notice they must give before moving out, though they do cover the notice required to end the tenancy after the fixed term (one month from the tenant, ending on a rent payment date) [1].

## Run 2 — same topic — How much notice do I give to move out?

Earlier: How much do I have to hand over at the start?

> At the start of the tenancy, you must pay:
> 
> * **Rent:** Rent is payable monthly in advance on the first day of each month [4].
> * **Deposit:** The deposit is five weeks' rent [1].
> * **Additional deposit (if applicable):** If you keep a pet with written consent, there is an additional deposit of one week's rent [3].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

To end the tenancy after the fixed term, you must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

To end the tenancy after the fixed term, the tenant must give one month's notice, which must end on a rent payment date [1]. The notice must be in writing; notices served by message or spoken in person have no effect [1].

## Run 2 — alone — How much do I have to hand over at the start?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

At the start of the tenancy, you must pay:

* **Rent:** Rent is payable monthly in advance on the first day of each month [4].
* **Deposit:** The deposit is equal to five weeks' rent [1]. 
* **Pets (if applicable):** If you keep a pet with written consent in a property with private outdoor space, consent carries an additional deposit of one week's rent [3].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

At the start of the tenancy, you must pay:

* Rent payable monthly in advance on the first day of each month [4].
* A deposit equal to five weeks' rent [1].
* An additional deposit of one week's rent if you keep a pet (one cat or one dog) in a property with private outdoor space [3].

## Run 2 — topic change — How much do I have to hand over at the start?

Earlier: How much warning do I need to give before it renews?

> You need to give 30 days' notice before the renewal date to cancel a Meridian support plan.

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: false

The documents do not cover upfront payments or what you have to hand over at the start, but they do state that the deposit is five weeks' rent.

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is five weeks' rent [1].

## Run 2 — same topic — How much do I have to hand over at the start?

Earlier: How much can the rent go up by?

> Rent increases are capped at the lower of the consumer price index or 4% [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The documents cover the Larkfield Property tenancy agreement and Meridian support policy [4][8]. They detail that the deposit is five weeks' rent, and pets carry an additional deposit of one week's rent [1][3].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover the total amount required at the start of the tenancy, though they state that the deposit is five weeks' rent [1].

## Run 2 — alone — What hours is the standard plan covered?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## Run 2 — topic change — What hours is the standard plan covered?

Earlier: What humidity needs a desiccant in storage?

> Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## Run 2 — same topic — What hours is the standard plan covered?

Earlier: What is the cap on credits in a month?

> The cap on credits in any calendar month is 25% of the monthly fee [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country.

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## Run 2 — alone — How much force does the press develop?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

## Run 2 — topic change — How much force does the press develop?

Earlier: The boiler died in January. How fast should someone come?

> Emergency repairs are attended within 24 hours [1]. An emergency includes the loss of heat in winter [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

## Run 2 — same topic — How much force does the press develop?

Earlier: How loud is it at a metre?

> The press itself measures 84 dB at one metre [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

## Run 2 — alone — How loud is it at a metre?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

At one metre, the press itself measures 84 dB [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

At one metre, the press itself measures 84 dB [1]. However, workpiece resonance routinely adds 10 to 15 dB [1][2].

## Run 2 — topic change — How loud is it at a metre?

Earlier: How much notice do I give to move out?

> After the fixed term, the tenancy continues monthly, and you must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press itself measures 84 dB at one metre [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press itself measures 84 dB at one metre [1].

## Run 2 — same topic — How loud is it at a metre?

Earlier: Which oil grade goes in it?

> The press requires ISO VG 46 mineral oil [1]. Synthetic alternatives are also compatible [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press itself measures 84 dB at one metre [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press itself measures 84 dB at one metre [1].

## Run 2 — alone — Which oil grade goes in it?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press uses ISO VG 46 mineral oil [1]. Synthetic alternatives are also compatible [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The documents specify that you should use ISO VG 46 mineral oil [1].

## Run 2 — topic change — Which oil grade goes in it?

Earlier: How much do I have to hand over at the start?

> At the start of the tenancy, you must pay:
> 
> * **Rent:** Rent is payable monthly in advance on the first day of each month [4].
> * **Deposit:** The deposit is five weeks' rent [1].
> * **Additional deposit (if applicable):** If you have a pet (one cat or one dog in properties with private outdoor space), written consent carries an additional deposit of one week's rent [3].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The documents specify using ISO VG 46 mineral oil [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

You should use ISO VG 46 mineral oil [1]. Synthetic alternatives are also compatible [1].

## Run 2 — same topic — Which oil grade goes in it?

Earlier: How often does the oil need changing?

> The hydraulic oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The equipment manual specifies ISO VG 46 mineral oil [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The documents specify using ISO VG 46 mineral oil [1].

## Run 2 — alone — How often does the oil need changing?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The hydraulic oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

## Run 2 — topic change — How often does the oil need changing?

Earlier: How much can the rent go up by?

> Rent increases are capped at the lower of the consumer price index or 4% [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The hydraulic oil must be changed every 2,000 operating hours or annually, whichever comes first [2].

## Run 2 — same topic — How often does the oil need changing?

Earlier: What oil temperature is too hot?

> An oil temperature above 70°C shortens seal life sharply [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

## Run 2 — alone — What oil temperature is too hot?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

An oil temperature above 70°C shortens seal life sharply [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

An oil temperature above 70°C shortens seal life sharply [1].

## Run 2 — topic change — What oil temperature is too hot?

Earlier: How long does the deposit take to be protected?

> The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Oil temperature above 70°C is too hot, as it sharply shortens seal life [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Oil temperature above 70°C shortens seal life sharply [1].

## Run 2 — same topic — What oil temperature is too hot?

Earlier: What torque do the die bolts take?

> The die bolts are torqued to 210 Nm in a diagonal sequence [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Oil temperature above 70°C shortens seal life sharply [1]. Additionally, fault code E04 indicates over-temperature when the oil is too hot [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover an absolute "too hot" temperature limit for the oil, but they state that an oil temperature above 70°C sharply shortens seal life [1]. They also mention an over-temperature fault code (E04) which latches until the oil falls below 60°C [2].

## Run 2 — alone — What torque do the die bolts take?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

## Run 2 — topic change — What torque do the die bolts take?

Earlier: How fast is a non-emergency repair attended?

> Non-emergency repairs are attended within 14 days [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm in a diagonal sequence.

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm [2].

## Run 2 — same topic — What torque do the die bolts take?

Earlier: How thin can a die be reground before it is scrap?

> A die that has been reground below 38 mm thickness must not be refitted [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm [2].

## Run 2 — alone — How thin can a die be reground before it is scrap?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

A die must not be refitted if it has been reground below 38 mm in thickness [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

A die must not be refitted if it has been reground below 38 mm thickness [1].

## Run 2 — topic change — How thin can a die be reground before it is scrap?

Earlier: How long can a guest stay before I have to tell anyone?

> Guests staying more than 14 consecutive nights require notification [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

A die must not be refitted if it has been reground below 38 mm in thickness [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

A die must not be refitted if it has been reground below 38 mm thickness [1].

## Run 2 — same topic — How thin can a die be reground before it is scrap?

Earlier: How far apart can the pressure sensors read before it stops?

> The press stops when the two pressure sensors differ by more than 5 bar [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

A die that has been reground below 38 mm thickness must not be refitted and is considered scrap [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

A die that has been reground below 38 mm thickness must not be refitted [1].

## Run 2 — alone — How far apart can the pressure sensors read before it stops?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

## Run 2 — topic change — How far apart can the pressure sensors read before it stops?

Earlier: How much is the extra deposit for a pet?

> The extra deposit for a pet is one week's rent [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops if the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

## Run 2 — same topic — How far apart can the pressure sensors read before it stops?

Earlier: What humidity needs a desiccant in storage?

> Storage humidity above 60% requires a desiccant in the control cabinet, regardless of duration [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops if the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops if the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

## Run 2 — alone — What humidity needs a desiccant in storage?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## Run 2 — topic change — What humidity needs a desiccant in storage?

Earlier: How much notice do I give if I am leaving?

> The tenant gives one month's notice ending on a rent payment date [1]. Notice must be in writing [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover notice periods. They cover equipment storage requirements and maintenance. 

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## Run 2 — same topic — What humidity needs a desiccant in storage?

Earlier: How much force does the press develop?

> The press develops 90 kilonewtons [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: false · cites: false · declined: true · read as a refusal: false

The documents do not cover how much force the press develops; they cover equipment maintenance, storage requirements, and guide rod replacement for Harbourline equipment.

## Run 2 — alone — How much can the rent go up by?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Rent increases are capped at the lower of the consumer price index or 4% [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Any rent increase is capped at the lower of the consumer price index or 4% [1].

## Run 2 — topic change — How much can the rent go up by?

Earlier: What do I get back if you miss a target?

> If a first response target is missed on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 
> 
> These credits are applied automatically to the next invoice and do not require you to claim them [2]. They serve as the only remedy for a missed target, meaning they are not a refund and cannot be exchanged for one [1][2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Rent increases are capped at the lower of the consumer price index or 4% [1]. Any increase also requires two months' written notice and can only occur once per year on the anniversary of the tenancy start date [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Rent increases are capped at the lower of the consumer price index or 4%, and the review requires two months' written notice [1].

## Run 2 — same topic — How much can the rent go up by?

Earlier: How long does the deposit take to be protected?

> The deposit must be registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Rent increases are capped at the lower of the consumer price index or 4% [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The rent increase is capped at the lower of the consumer price index or 4% [1].

## Run 2 — alone — How long does the deposit take to be protected?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit must be registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## Run 2 — topic change — How long does the deposit take to be protected?

Earlier: What hours is the standard plan covered?

> Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## Run 2 — same topic — How long does the deposit take to be protected?

Earlier: How fast is a non-emergency repair attended?

> Non-emergency repairs are attended within 14 days [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## Run 2 — alone — How fast is a non-emergency repair attended?

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days.

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days [1].

## Run 2 — topic change — How fast is a non-emergency repair attended?

Earlier: What is the cap on credits in a month?

> The cap on credits in any calendar month is 25% of the monthly fee [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days.

## Run 2 — same topic — How fast is a non-emergency repair attended?

Earlier: How long can a guest stay before I have to tell anyone?

> Guests staying more than 14 consecutive nights require notification [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days [1].

## Run 2 — alone — How long can a guest stay before I have to tell anyone?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

## Run 2 — topic change — How long can a guest stay before I have to tell anyone?

Earlier: How quickly does someone get back to me if everything is down?

> The first response target for Severity 1 tickets—defined as a production system being unavailable to all users—is 30 minutes, measured from ticket creation [3][4]. 
> 
> If you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and its 30-minute response clock begins when coverage resumes [1]. If you are on a Premier plan, coverage is continuous, including weekends and holidays [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification, while staying for more than 28 nights constitutes occupation and requires consent [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

## Run 2 — same topic — How long can a guest stay before I have to tell anyone?

Earlier: How much is the extra deposit for a pet?

> The extra deposit for a pet is one week's rent [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

## Run 2 — alone — How much is the extra deposit for a pet?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

## Run 2 — topic change — How much is the extra deposit for a pet?

Earlier: How long do you keep whatever I attach to a ticket?

> Anything sent to the ticket system is deleted 90 days after ticket closure [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The additional deposit for a pet is one week's rent [1].

## Run 2 — same topic — How much is the extra deposit for a pet?

Earlier: How much notice do I give if I am leaving?

> The tenant gives one month's notice ending on a rent payment date [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

## Run 2 — alone — How much notice do I give if I am leaving?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

To end the tenancy after the fixed term, the tenant must give one month's notice ending on a rent payment date [1]. Notice must be in writing, as a notice served by message or spoken in person has no effect [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The tenant must give one month's notice ending on a rent payment date [1].

## Run 2 — topic change — How much notice do I give if I am leaving?

Earlier: How much warning do I need to give before it renews?

> You need to give 30 days' notice before the renewal date to cancel a support plan [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover leaving a support plan beyond cancellation rules, but for ending the tenancy, the tenant must give one month's notice ending on a rent payment date, while the landlord must give two months' notice [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover leaving an employment position; they cover tenancy agreements and ending a support plan. For a tenancy, the tenant gives one month's notice ending on a rent payment date [1].

## Run 2 — same topic — How much notice do I give if I am leaving?

Earlier: The boiler died in January. How fast should someone come?

> The documents cover emergency and non-emergency repair response times, landlord and tenant responsibilities, and support ticket policies. 
> 
> Emergency repairs are attended within 24 hours, where an emergency is defined as a loss of heat in winter, a loss of water, an unsecured entrance, or anything presenting a risk to health [1]. Non-emergency repairs are attended within 14 days [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

After the fixed term, the tenancy continues monthly [1]. If you are leaving, you must give one month's notice ending on a rent payment date [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

After the fixed term, the tenancy continues monthly [1]. If you are the tenant, you must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

## Run 2 — alone — What is the cap on credits in a month?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

## Run 2 — topic change — What is the cap on credits in a month?

Earlier: How much force does the press develop?

> The press develops 90 kilonewtons [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much force a press develops. They do, however, cover support plans, credits, data handling during support, ticket escalation, and ending or downgrading a support plan.

The cap on credits in any calendar month is 25% of the monthly fee [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

## Run 2 — same topic — What is the cap on credits in a month?

Earlier: How quickly does someone get back to me if everything is down?

> If a production system is unavailable to all users (Severity 1), the first response target is 30 minutes from ticket creation [3][4]. 
> 
> However, if you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute response clock does not begin until coverage resumes [1]. Premier plans, by contrast, are covered continuously [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The cap on credits in any calendar month is 25% [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover the first response targets for Severity 1 tickets, but they do cover service credits, stating that missing a first response target on a Premier plan is capped at 25% in any calendar month [1].

## Run 3 — alone — How quickly does someone get back to me if everything is down?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

For a Severity 1 issue (meaning a production system is unavailable to all users), the first response target is 30 minutes from ticket creation [3][4]. 

However, if you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes [1]. Premier plans, by contrast, are covered continuously [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

When a production system is unavailable to all users (Severity 1), the first response target is 30 minutes from ticket creation [3][4]. 

If you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the 30-minute clock does not run overnight; instead, the ticket is queued and begins its clock when coverage resumes [1]. Premier plans are covered continuously [1].

## Run 3 — topic change — How quickly does someone get back to me if everything is down?

Earlier: What oil temperature is too hot?

> An oil temperature above 70°C shortens seal life sharply [1]. Additionally, an oil temperature over 70°C triggers fault code E04 (over-temperature) [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

For a Severity 1 ticket—which means a production system is unavailable to all users—the first response target is 30 minutes from ticket creation [3][4]. 

However, if you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and its 30-minute clock does not begin until coverage resumes, as the clock does not run overnight [1]. Premier plans, by contrast, are covered continuously [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

For a Severity 1 ticket (where a production system is unavailable to all users), the first response target is 30 minutes from ticket creation [3][4]. 

However, if you are on a Standard plan and raise the ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and its 30-minute clock begins only when coverage resumes, as the clock does not run overnight [1]. If you are on a Premier plan, support is covered continuously, including weekends and holidays [1].

## Run 3 — same topic — How quickly does someone get back to me if everything is down?

Earlier: How long do you keep whatever I attach to a ticket?

> Anything sent to the ticket system is deleted 90 days after ticket closure [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The first response target is 30 minutes for Severity 1 tickets (which apply when a production system is unavailable to all users), measured from ticket creation [3][4]. 

For Standard plans, if a Severity 1 ticket is raised outside covered hours (09:00 to 18:00 in the registered timezone, Monday to Friday, excluding public holidays), the 30-minute clock does not run overnight and begins when coverage resumes [1]. Premier plans, however, are covered continuously [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover response times for a system that is completely down, but they do cover first response targets measured from ticket creation: 30 minutes for Severity 1 (defined as a production system unavailable to all users) [3][4].

## Run 3 — alone — How long do you keep whatever I attach to a ticket?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything you send is deleted from the ticket system 90 days after closure [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything sent to the ticket system is deleted 90 days after ticket closure [1].

## Run 3 — topic change — How long do you keep whatever I attach to a ticket?

Earlier: What torque do the die bolts take?

> The die bolts are torqued to 210 Nm in a diagonal sequence [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything you send is deleted from the ticket system 90 days after closure [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything sent in a ticket is deleted 90 days after the ticket is closed [1].

## Run 3 — same topic — How long do you keep whatever I attach to a ticket?

Earlier: How much warning do I need to give before it renews?

> You need to give 30 days' notice before the renewal date to cancel a support plan [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything you send is deleted from the ticket system 90 days after closure [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Anything a customer sends is deleted from the ticket system 90 days after closure [1].

## Run 3 — alone — How much warning do I need to give before it renews?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

You need to give 30 days' notice before the renewal date to cancel a support plan [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

You need to give 30 days' notice before the renewal date to cancel a support plan [1].

## Run 3 — topic change — How much warning do I need to give before it renews?

Earlier: How thin can a die be reground before it is scrap?

> A die must not be refitted if it has been reground below 38 mm in thickness [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: false

The documents do not cover the renewal notice period for a die or tenancy agreement; they cover Meridian support plan renewals, which require 30 days' notice before the renewal date.

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much warning is needed before a tenancy renews, but they do cover support plans, which renew annually unless cancelled 30 days before the renewal date [1].

## Run 3 — same topic — How much warning do I need to give before it renews?

Earlier: What do I get back if you miss a target?

> If a Premier plan misses a first response target, you receive a service credit of 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 
> 
> These credits are applied automatically to the next invoice without requiring a claim, and they serve as the sole remedy for a missed target (they are not a refund and cannot be exchanged for one) [2].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover the renewal warning period for a tenancy agreement, but they cover support plans, which require cancellation 30 days before the renewal date [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much warning to give for tenancy renewals, but they do state that support plans renew annually unless cancelled 30 days before the renewal date [1].

## Run 3 — alone — What do I get back if you miss a target?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

On a Premier plan, missing a first response target credits 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 

These credits are applied automatically to the next invoice without requiring a claim [2]. They are the only remedy for a missed target, as they are not a refund and cannot be exchanged for one [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

If you miss a first response target on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. 

Credits are applied automatically to the next invoice and do not require you to claim them [2]. They are the only remedy for a missed target, and they are not a refund and cannot be exchanged for one [1][2].

## Run 3 — topic change — What do I get back if you miss a target?

Earlier: How far apart can the pressure sensors read before it stops?

> The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

For a Premier plan, missing a first response target credits 5% of the monthly fee per missed target, up to a maximum cap of 25% in any calendar month [2]. These credits are applied automatically to the next invoice [2]. 

Standard plans do not receive service credits [2]. Credits serve as the sole remedy for a missed target; they are not a refund and cannot be exchanged for one [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover refunds or cash back; missing a first response target on a Premier plan results in a credit of 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. These credits are applied automatically to the next invoice, are the only remedy for a missed target, and cannot be exchanged for a refund [2].

## Run 3 — same topic — What do I get back if you miss a target?

Earlier: What hours is the standard plan covered?

> Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Missing a first response target on a Premier plan credits 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. These credits are applied automatically to the next invoice and do not require you to claim them [2]. They serve as the only remedy for a missed target, are not a refund, and cannot be exchanged for one [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Missing a first response target on a Premier plan credits 5% of the monthly fee per missed target, capped at 25% in any calendar month [2]. Standard plans carry no service credits [2]. These credits are applied automatically to the next invoice and serve as the only remedy for a missed target; they are not a refund and cannot be exchanged for one [2].

## Run 3 — alone — The boiler died in January. How fast should someone come?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Emergency repairs, which include the loss of heat in winter, are attended within 24 hours [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The loss of heat in winter is classified as an emergency, and emergency repairs are attended to within 24 hours [1].

## Run 3 — topic change — The boiler died in January. How fast should someone come?

Earlier: How quickly does someone get back to me if everything is down?

> For a Severity 1 issue (where a production system is unavailable to all users), the first response target is 30 minutes from ticket creation [3][4]. 
> 
> However, if you are on a Standard plan and raise the ticket outside of covered hours (which are 09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes [1]. Premier plans have continuous coverage, including weekends and holidays [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The landlord attends to emergency repairs within 24 hours [1]. An emergency includes the loss of heat in winter [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The loss of heat in winter is classified as an emergency repair, and emergency repairs are attended within 24 hours [1]. 

If the landlord cannot be reached within four hours, you may arrange the emergency repair yourself and recover the reasonable cost against your rent, provided you produce the invoice [1].

## Run 3 — same topic — The boiler died in January. How fast should someone come?

Earlier: How much notice do I give to move out?

> After the fixed term, the tenancy continues monthly, and you must give one month's notice ending on a rent payment date [1]. The notice must be in writing; notices served by message or spoken in person have no effect [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Loss of heat in winter is considered an emergency repair, which is attended to within 24 hours [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Emergency repairs are attended within 24 hours, and loss of heat in winter is classified as an emergency [1].

## Run 3 — alone — How much notice do I give to move out?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

To end the tenancy after the fixed term, you must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

After the fixed term, the tenant gives one month's notice ending on a rent payment date [1]. Notice must be in writing [1].

## Run 3 — topic change — How much notice do I give to move out?

Earlier: How long do you keep whatever I attach to a ticket?

> Anything sent to the ticket system is deleted 90 days after closure [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how long you keep items attached to a ticket. 

Regarding moving out, the tenant must give one month's notice ending on a rent payment date after the fixed term when the tenancy continues monthly [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The tenant must give one month's notice ending on a rent payment date, while the landlord must give two months' notice [1].

## Run 3 — same topic — How much notice do I give to move out?

Earlier: How much do I have to hand over at the start?

> At the start of the tenancy, you must pay:
> 
> * **Rent:** Rent is payable monthly in advance on the first day of each month [4].
> * **Deposit:** The deposit is five weeks' rent [1].
> * **Additional deposit for pets (if applicable):** If you have a pet with written consent, it carries an additional deposit of one week's rent [3].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover moving out notice periods beyond what applies after the fixed term, where the tenant must give one month's notice ending on a rent payment date [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

After the fixed term, the tenant must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

## Run 3 — alone — How much do I have to hand over at the start?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

At the start of the tenancy, you must pay:

* **Rent:** Rent is payable monthly in advance on the first day of each month [4].
* **Deposit:** The deposit is five weeks' rent [1].
* **Pet deposit (if applicable):** If you have a pet with written consent, it carries an additional deposit of one week's rent [3].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

At the start of the tenancy, you must pay:

* **Rent:** Rent is payable monthly in advance on the first day of each month [4]. 
* **Deposit:** The deposit is equal to five weeks' rent [1].
* **Pets (if applicable):** If you have a pet (one cat or one dog in properties with private outdoor space, which is granted by default with written consent), there is an additional deposit of one week's rent [3].

## Run 3 — topic change — How much do I have to hand over at the start?

Earlier: How much warning do I need to give before it renews?

> You need to give 30 days' notice before the renewal date to cancel a support plan [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is five weeks' rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much money you have to hand over at the start, though they do state that the deposit is five weeks' rent [1] and that rent is payable monthly in advance on the first day of each month [4].

## Run 3 — same topic — How much do I have to hand over at the start?

Earlier: How much can the rent go up by?

> Rent increases are capped at the lower of the consumer price index or 4% [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover the total amount due at the start, though they state that the deposit is five weeks' rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much money in total must be handed over at the start, though they state that the deposit is five weeks' rent [1].

## Run 3 — alone — What hours is the standard plan covered?

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country.

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## Run 3 — topic change — What hours is the standard plan covered?

Earlier: What humidity needs a desiccant in storage?

> Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## Run 3 — same topic — What hours is the standard plan covered?

Earlier: What is the cap on credits in a month?

> The cap on credits in any calendar month is 25% of the monthly fee [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country.

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

## Run 3 — alone — How much force does the press develop?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

## Run 3 — topic change — How much force does the press develop?

Earlier: The boiler died in January. How fast should someone come?

> The documents cover emergency and non-emergency repair response times, landlord and tenant repair responsibilities, and support policies.
> 
> Emergency repairs are attended within 24 hours [1]. An emergency is defined as loss of heat in winter, loss of water, an unsecured entrance, or anything presenting a risk to health [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

## Run 3 — same topic — How much force does the press develop?

Earlier: How loud is it at a metre?

> The press itself measures 84 dB at one metre [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press develops 90 kilonewtons [1].

## Run 3 — alone — How loud is it at a metre?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press measures 84 dB at one metre [1]. However, workpiece resonance routinely adds 10 to 15 dB and cannot be predicted from the material alone [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press itself measures 84 dB at one metre [1].

## Run 3 — topic change — How loud is it at a metre?

Earlier: How much notice do I give to move out?

> After the fixed term, the tenant must give one month's notice ending on a rent payment date [1]. Notice must be in writing [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press itself measures 84 dB at one metre [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press measures 84 dB at one metre [1].

## Run 3 — same topic — How loud is it at a metre?

Earlier: Which oil grade goes in it?

> The documents cover the Harbourline HL-90 Bench Press operating manual, including safety, hydraulic oil requirements, daily checks, die changes, and fault codes.
> 
> ISO VG 46 mineral oil is used in the press [1]. Synthetic alternatives are also compatible [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press itself measures 84 dB at one metre [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press itself measures 84 dB at one metre [1].

## Run 3 — alone — Which oil grade goes in it?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

ISO VG 46 mineral oil is used [1]. Synthetic alternatives are also compatible [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The documents specify that you should use ISO VG 46 mineral oil [1].

## Run 3 — topic change — Which oil grade goes in it?

Earlier: How much do I have to hand over at the start?

> At the start of the tenancy, you must pay:
> 
> * Rent payable monthly in advance on the first day of each month [4].
> * A deposit of five weeks' rent [1].
> * If you have a pet (one cat or one dog in properties with private outdoor space), there is an additional deposit of one week's rent [3].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

You should use ISO VG 46 mineral oil [1]. Synthetic alternatives are also compatible [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Use ISO VG 46 mineral oil [1].

## Run 3 — same topic — Which oil grade goes in it?

Earlier: How often does the oil need changing?

> The hydraulic oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The documents specify using ISO VG 46 mineral oil [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The documents specify using ISO VG 46 mineral oil [1].

## Run 3 — alone — How often does the oil need changing?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The hydraulic oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The hydraulic oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

## Run 3 — topic change — How often does the oil need changing?

Earlier: How much can the rent go up by?

> Any rent increase is capped at the lower of the consumer price index or 4% [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The hydraulic oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how often the rent can go up; they cover hydraulic equipment maintenance, including changing the oil every 2,000 operating hours or annually, whichever comes first [2].

## Run 3 — same topic — How often does the oil need changing?

Earlier: What oil temperature is too hot?

> Oil temperatures above 70°C shorten seal life sharply [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The oil needs to be changed every 2,000 operating hours or annually, whichever comes first [2].

## Run 3 — alone — What oil temperature is too hot?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Oil temperatures above 70°C shorten seal life sharply [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Oil temperature above 70°C shortens seal life sharply [1].

## Run 3 — topic change — What oil temperature is too hot?

Earlier: How long does the deposit take to be protected?

> The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Oil temperature above 70°C is too hot, as it sharply shortens seal life [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Oil temperature above 70°C is too hot, as it sharply shortens seal life [1].

## Run 3 — same topic — What oil temperature is too hot?

Earlier: What torque do the die bolts take?

> The die bolts are torqued to 210 Nm in a diagonal sequence [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

An oil temperature above 70°C shortens seal life sharply [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Oil temperature above 70°C shortens seal life sharply [1].

## Run 3 — alone — What torque do the die bolts take?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

## Run 3 — topic change — What torque do the die bolts take?

Earlier: How fast is a non-emergency repair attended?

> A non-emergency repair is attended within 14 days.

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm in a diagonal sequence [2].

## Run 3 — same topic — What torque do the die bolts take?

Earlier: How thin can a die be reground before it is scrap?

> A die that has been reground below 38 mm thickness must not be refitted [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Dies are held by four M16 bolts torqued to 210 Nm in a diagonal sequence [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The die bolts are torqued to 210 Nm [2].

## Run 3 — alone — How thin can a die be reground before it is scrap?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

A die that has been reground below 38 mm thickness must not be refitted [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

A die must not be refitted if it has been reground below 38 mm in thickness [1].

## Run 3 — topic change — How thin can a die be reground before it is scrap?

Earlier: How long can a guest stay before I have to tell anyone?

> Guests staying more than 14 consecutive nights require notification [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

A die must not be refitted if it has been reground below 38 mm thickness [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

A die must not be refitted if it has been reground below 38 mm thickness [1].

## Run 3 — same topic — How thin can a die be reground before it is scrap?

Earlier: How far apart can the pressure sensors read before it stops?

> The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

A die that has been reground below 38 mm thickness must not be refitted and is considered too thin [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

A die that has been reground below 38 mm thickness must not be refitted [1].

## Run 3 — alone — How far apart can the pressure sensors read before it stops?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops when the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

## Run 3 — topic change — How far apart can the pressure sensors read before it stops?

Earlier: How much is the extra deposit for a pet?

> The extra deposit for a pet is one week's rent [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops when the two pressure sensors differ by more than 5 bar [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops if the two pressure sensors differ by more than 5 bar (indicated by error code E07) [1].

## Run 3 — same topic — How far apart can the pressure sensors read before it stops?

Earlier: What humidity needs a desiccant in storage?

> Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops if the two pressure sensors differ by more than 5 bar [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The press stops when the two pressure sensors differ by more than 5 bar (indicated by fault code E07) [1].

## Run 3 — alone — What humidity needs a desiccant in storage?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## Run 3 — topic change — What humidity needs a desiccant in storage?

Earlier: How much notice do I give if I am leaving?

> The tenant gives one month's notice ending on a rent payment date [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## Run 3 — same topic — What humidity needs a desiccant in storage?

Earlier: How much force does the press develop?

> The press develops 90 kilonewtons [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much force the press develops; they cover equipment storage guidelines, specifically noting that storage humidity above 60% requires a desiccant in the control cabinet regardless of duration [1].

## Run 3 — alone — How much can the rent go up by?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Any rent increase is capped at the lower of the consumer price index or 4% [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Rent increases are capped at the lower of the consumer price index or 4% [1].

## Run 3 — topic change — How much can the rent go up by?

Earlier: What do I get back if you miss a target?

> If a first response target is missed on a Premier plan, you receive a credit of 5% of the monthly fee per missed target, up to a maximum cap of 25% in any calendar month [2]. These credits are applied automatically to your next invoice without requiring you to claim them [2]. Standard plans do not carry service credits [2]. 
> 
> These credits serve as the sole remedy for a missed target, and they cannot be exchanged for a refund [1][2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Rent increases are capped at the lower of the consumer price index or 4% [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much the rent can go up by overall, other than stating that any rent increase is capped at the lower of the consumer price index or 4% [1].

## Run 3 — same topic — How much can the rent go up by?

Earlier: How long does the deposit take to be protected?

> The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Any rent increase is capped at the lower of the consumer price index or 4% [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Any rent increase is capped at the lower of the consumer price index or 4% [1].

## Run 3 — alone — How long does the deposit take to be protected?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit must be registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## Run 3 — topic change — How long does the deposit take to be protected?

Earlier: What hours is the standard plan covered?

> Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## Run 3 — same topic — How long does the deposit take to be protected?

Earlier: How fast is a non-emergency repair attended?

> Non-emergency repairs are attended within 14 days [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## Run 3 — alone — How fast is a non-emergency repair attended?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

A non-emergency repair is attended within 14 days [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days.

## Run 3 — topic change — How fast is a non-emergency repair attended?

Earlier: What is the cap on credits in a month?

> The cap on credits in any calendar month is 25% of the monthly fee [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days.

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days [1].

## Run 3 — same topic — How fast is a non-emergency repair attended?

Earlier: How long can a guest stay before I have to tell anyone?

> Guests staying more than 14 consecutive nights require notification [2].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Non-emergency repairs are attended within 14 days [1].

## Run 3 — alone — How long can a guest stay before I have to tell anyone?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

## Run 3 — topic change — How long can a guest stay before I have to tell anyone?

Earlier: How quickly does someone get back to me if everything is down?

> For a Severity 1 issue (meaning a production system is unavailable to all users), the first response target is 30 minutes from ticket creation [3][4]. 
> 
> However, if you are on a Standard plan and raise the ticket outside of coverage hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute clock does not begin until coverage resumes [1]. Premier plans, on the other hand, are covered continuously [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2]. Stays of more than 28 nights constitute occupation and require consent [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

## Run 3 — same topic — How long can a guest stay before I have to tell anyone?

Earlier: How much is the extra deposit for a pet?

> The additional deposit for a pet is one week's rent [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

Guests staying more than 14 consecutive nights require notification [2].

## Run 3 — alone — How much is the extra deposit for a pet?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

## Run 3 — topic change — How much is the extra deposit for a pet?

Earlier: How long do you keep whatever I attach to a ticket?

> Anything a customer sends is deleted from the ticket system 90 days after closure [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

## Run 3 — same topic — How much is the extra deposit for a pet?

Earlier: How much notice do I give if I am leaving?

> After the fixed term, the tenant must give one month's notice ending on a rent payment date [1]. The notice must be in writing, as notices served by message or spoken in person have no effect [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The extra deposit for a pet is one week's rent [1].

## Run 3 — alone — How much notice do I give if I am leaving?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

If you are ending the tenancy after the fixed term, you must give one month's notice ending on a rent payment date [1]. The notice must be in writing, as notices served by message or spoken in person have no effect [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The tenant gives one month's notice ending on a rent payment date [1].

## Run 3 — topic change — How much notice do I give if I am leaving?

Earlier: How much warning do I need to give before it renews?

> You need to give 30 days' notice before the renewal date to cancel a support plan [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover leaving a support plan beyond cancellation rules, but for ending the tenancy, the tenant must give one month's notice ending on a rent payment date (while the landlord gives two months') [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The tenant must give one month's notice ending on a rent payment date to end the tenancy after the fixed term [1].

## Run 3 — same topic — How much notice do I give if I am leaving?

Earlier: The boiler died in January. How fast should someone come?

> Emergency repairs are attended within 24 hours, and an emergency is defined as including a loss of heat in winter [1].

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

After the fixed term, the tenant must give one month's notice ending on a rent payment date [1]. The notice must be in writing [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

After the fixed term, the tenant must give one month's notice ending on a rent payment date [1].

## Run 3 — alone — What is the cap on credits in a month?

**rule 7 as of v1.11.0** · grounded: true · cites: true · declined: false · read as a refusal: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: true · declined: false · read as a refusal: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

## Run 3 — topic change — What is the cap on credits in a month?

Earlier: How much force does the press develop?

> The press develops 90 kilonewtons [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much force a press develops, but they do cover support policies including credits [1][2][3][4]. 

The cap on credits is 25% of the monthly fee in any calendar month [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover how much force a press develops, but they cover support policies including service credits, escalation, data handling, and ending a support plan [1][2][3][4].

The cap on credits is 25% of the monthly fee in any calendar month [1].

## Run 3 — same topic — What is the cap on credits in a month?

Earlier: How quickly does someone get back to me if everything is down?

> If a production system is unavailable to all users (Severity 1), the first response target is 30 minutes from ticket creation [3][4]. 
> 
> However, if you are on a Standard plan and raise a Severity 1 ticket outside of covered hours (09:00 to 18:00 in your registered timezone, Monday to Friday, excluding public holidays), the ticket is queued and the 30-minute response clock does not begin until coverage resumes [1]. Premier plans, by contrast, are covered continuously, including weekends and holidays [1].

**rule 7 as of v1.11.0** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover response times for system outages or whether everything is down, but they do cover credits for missed response targets: the cap on credits in any calendar month is 25% of the monthly fee [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · grounded: true · cites: false · declined: true · read as a refusal: true

The documents do not cover severity levels, production system availability, or response times. They do cover service credits for missed first response targets on Premier plans, which are capped at 25% of the monthly fee in any calendar month [1].

## Run 1 — follow-up — and the fault code?

Earlier: What is the maximum oil temperature?

> The documents do not cover the maximum oil temperature, though they do note that oil temperature above 70°C sharply shortens seal life [1].

**rule 7 as of v1.11.0** · cites: false · declined: true

The documents do not cover a fault code for a maximum oil temperature. They do cover fault code E04, which indicates an over-temperature condition [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

E04 indicates over-temperature [1].

## Run 1 — follow-up — on premier?

Earlier: Is support covered at the weekend?

> Whether support is covered at the weekend depends on your support plan:
> 
> * **Premier plans** are covered continuously, including weekends and holidays [1].
> * **Standard plans** are covered Monday to Friday from 09:00 to 18:00 in the customer's registered timezone, excluding public holidays, and do not run overnight or during the weekend [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

Yes, Premier plans are covered continuously, including weekends and holidays [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

Yes, Premier plans are covered continuously, which includes weekends and holidays [2].

## Run 1 — follow-up — how often?

Earlier: What oil does the press take?

> The press uses ISO VG 46 mineral oil [1]. Synthetic alternatives are also compatible [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

The hydraulic oil should be changed every 2,000 operating hours or annually, whichever comes first [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

The hydraulic oil should be changed every 2,000 operating hours or annually, whichever comes first [1].

## Run 1 — follow-up — and the filter?

Earlier: What oil does the press take?

> The press takes ISO VG 46 mineral oil [1]. Synthetic alternatives are also compatible [1].

**rule 7 as of v1.11.0** · cites: false · declined: true

The documents do not cover filter specifications beyond the replacement interval and warning that the filter is not cleanable.

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: false · declined: true

The documents do not cover the filter specifications, though they note that the filter is changed every 2,000 operating hours or annually (whichever comes first) and is not cleanable [1].

## Run 1 — follow-up — what about the deposit?

Earlier: Can I keep a cat?

> Pets require written consent, which is granted by default for one cat or one dog in properties with private outdoor space [1]. This consent requires an additional deposit of one week's rent, which is registered under the same scheme and returned on the same terms [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

Consent for a pet carries an additional deposit of one week's rent, which is registered under the same scheme and returned on the same terms [3].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: false · declined: false

The standard deposit is five weeks' rent, and if you keep a cat or a dog, there is an additional deposit of one week's rent that is registered under the same scheme and returned on the same terms.

## Run 1 — follow-up — in writing?

Earlier: How much notice must I give to leave?

> You must give one month's notice, ending on a rent payment date [1]. The notice must be in writing [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

Yes, notice must be in writing, as a notice served by message or spoken in person has no effect [7].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

Yes, the notice must be in writing [7]. A notice served by message or spoken in person has no effect [7].

## Run 1 — follow-up — how much is it?

Earlier: What can be deducted from the deposit at the end?

> Deductions from the deposit may be made for:
> * Unpaid rent [1]
> * Damage beyond fair wear and tear [1]
> * Professional cleaning, provided the property was professionally cleaned at the start of the tenancy [1]
> 
> Deductions may not be made for redecoration attributable to ordinary use [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

The deposit is five weeks' rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

The deposit is five weeks' rent [1].

## Run 1 — follow-up — why?

Earlier: Are resolution times guaranteed for a Severity 3 defect?

> No, resolution targets are deliberately not contractual for Severity 3 tickets [1].

Searched for: Why are resolution targets deliberately not contractual for Severity 3 tickets?

**rule 7 as of v1.11.0** · cites: true · declined: false

A defect with a workaround is scheduled against the release train rather than against a clock, and promising otherwise would mean either missing the promise or shipping a rushed fix [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

Resolution targets for Severity 3 defects are not contractual because promising otherwise would mean either missing the promise or shipping a rushed fix [1].

## Run 1 — follow-up — who handles it then?

Earlier: Can a customer escalate a ticket?

> Yes, any ticket may be escalated once by the customer without justification [2]. A second escalation requires a named business impact [2]. Escalation moves the ticket to the duty lead, who owns it until closure and cannot reassign it back to the original queue [1][2].

**rule 7 as of v1.11.0** · cites: true · declined: false

Escalation moves the ticket to the duty lead, who owns it until closure and cannot reassign it back to the original queue [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

Escalation moves the ticket to the duty lead, who owns it until closure and may not reassign it back to the original queue [1].

## Run 1 — follow-up — and outside them?

Earlier: What are the coverage hours on a Standard plan?

> Standard plans are covered from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 as of v1.11.0** · cites: false · declined: true

The documents do not cover support coverage outside of standard hours, though they do cover response targets, data handling during support, and tenancy agreements.

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: false · declined: true

The documents do not cover what happens outside of coverage hours on a Standard plan. They do cover support hours, coverage tiers (Standard and 24/7), first response targets, and resolution targets [8].

## Run 2 — follow-up — and the fault code?

Earlier: What is the maximum oil temperature?

> The documents do not cover a maximum oil temperature, but they do state that an oil temperature above 70°C sharply shortens seal life [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

E04 indicates over-temperature [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

The fault code for over-temperature is E01, which indicates low oil level, and E04 indicates over-temperature [1].

## Run 2 — follow-up — on premier?

Earlier: Is support covered at the weekend?

> Whether support is covered at the weekend depends on your support plan:
> 
> * **Standard plans** are covered Monday to Friday from 09:00 to 18:00 in the customer's registered timezone, excluding public holidays, and do not include weekend coverage [1].
> * **Premier plans** are covered continuously, which includes weekends and holidays [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

Yes, Premier plans are covered continuously, which includes weekends and holidays [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

Yes, Premier plans are covered continuously, which includes weekends and holidays [2].

## Run 2 — follow-up — how often?

Earlier: What oil does the press take?

> The press takes ISO VG 46 mineral oil [1]. Synthetic alternatives are also compatible [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

The hydraulic oil should be changed every 2,000 operating hours or annually, whichever comes first [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: false · declined: true

The documents do not cover how often oil is added, but they do state that the oil must be changed every 2,000 operating hours or annually, whichever comes first [1].

## Run 2 — follow-up — and the filter?

Earlier: What oil does the press take?

> The press takes ISO VG 46 mineral oil [1]. Synthetic alternatives are also compatible [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

The filter is changed every 2,000 operating hours or annually (whichever comes first) at the same interval as the oil, and it is not cleanable [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

The filter is changed at the same interval as the oil (every 2,000 operating hours or annually, whichever comes first) and is not cleanable, as a filter that looks clean has usually failed open [1].

## Run 2 — follow-up — what about the deposit?

Earlier: Can I keep a cat?

> Yes, pets require written consent, which is granted by default for one cat or one dog in properties with private outdoor space [1]. This consent carries an additional deposit of one week's rent [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

Consent for a cat or dog carries an additional deposit of one week's rent [3]. This deposit is registered under the same scheme and is returned on the same terms [3].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

Consent for a cat or dog carries an additional deposit of one week's rent [3]. This additional deposit is registered under the same scheme and returned on the same terms [3].

## Run 2 — follow-up — in writing?

Earlier: How much notice must I give to leave?

> The tenant must give one month's notice ending on a rent payment date [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

Yes, the notice must be in writing, as a notice served by message or spoken in person has no effect [7].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

Yes, notice must be in writing, as a notice served by message or spoken in person has no effect [7].

## Run 2 — follow-up — how much is it?

Earlier: What can be deducted from the deposit at the end?

> Deductions from the deposit may be made for:
> * Unpaid rent [1].
> * Damage beyond fair wear and tear [1].
> * Professional cleaning, provided the property was professionally cleaned at the start of the tenancy [1]. 
> 
> Deductions may not be made for redecoration attributable to ordinary use [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

The deposit is five weeks' rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

The deposit is five weeks' rent [1].

## Run 2 — follow-up — why?

Earlier: Are resolution times guaranteed for a Severity 3 defect?

> No, resolution targets are deliberately not contractual for Severity 3 and 4 defects [1].

Searched for: Why are resolution targets deliberately not contractual for Severity 3 and 4 defects?

**rule 7 as of v1.11.0** · cites: true · declined: false

Resolution targets are not contractual for Severity 3 and 4 defects because a defect with a workaround is scheduled against the release train rather than a clock, and promising otherwise would mean either missing the promise or shipping a rushed fix [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

The documents explain that resolution targets are not contractual for Severity 3 and 4 defects because a defect with a workaround is scheduled against the release train rather than against a clock, and promising otherwise would mean either missing the promise or shipping a rushed fix [1].

## Run 2 — follow-up — who handles it then?

Earlier: Can a customer escalate a ticket?

> Yes, any ticket may be escalated once by the customer without justification [2]. A second escalation requires a named business impact [2].

**rule 7 as of v1.11.0** · cites: true · declined: false

Escalation moves the ticket to the duty lead, who owns it until closure and may not reassign it back to the original queue [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

Escalation moves the ticket to the duty lead, who owns it until closure and may not reassign it back to the original queue [5].

## Run 2 — follow-up — and outside them?

Earlier: What are the coverage hours on a Standard plan?

> On a Standard plan, coverage hours are from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 as of v1.11.0** · cites: false · declined: true

The documents do not cover what happens outside the coverage hours on a Standard plan. They do cover coverage hours, response targets, severity definitions, escalation procedures, and support channels under the Meridian support policy.

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: false · declined: true

The documents do not cover what happens outside of coverage hours on a Standard plan.

## Run 3 — follow-up — and the fault code?

Earlier: What is the maximum oil temperature?

> The documents do not cover a maximum oil temperature, but they do state that oil temperature above 70°C sharply shortens seal life, and they cover fault code E04, which indicates over-temperature and latches until the oil falls below 60°C [1][2].

**rule 7 as of v1.11.0** · cites: true · declined: false

Fault code E04 indicates over-temperature [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

Fault code E04 indicates over-temperature [1]. It latches until the oil falls below 60°C and will not clear on a power cycle [1].

## Run 3 — follow-up — on premier?

Earlier: Is support covered at the weekend?

> Whether support is covered at the weekend depends on the support plan:
> 
> * **Standard plans** are covered Monday to Friday only, excluding public holidays, and do not provide coverage over the weekend [1].
> * **Premier plans** are covered continuously, which includes weekends and holidays [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

Yes, Premier plans are covered continuously, including weekends and holidays [2].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

Yes, Premier plans are covered continuously, including weekends and holidays [2].

## Run 3 — follow-up — how often?

Earlier: What oil does the press take?

> The press takes ISO VG 46 mineral oil [1]. Synthetic alternatives are also compatible [1].

**rule 7 as of v1.11.0** · cites: false · declined: true

The documents do not cover how often oil is added, but they do state that the oil should be changed every 2,000 operating hours or annually, whichever comes first [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

The hydraulic oil should be changed every 2,000 operating hours or annually, whichever comes first [1].

## Run 3 — follow-up — and the filter?

Earlier: What oil does the press take?

> The press takes ISO VG 46 mineral oil [1]. Synthetic alternatives are also compatible [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

The filter is changed every 2,000 operating hours or annually (whichever comes first) at the same interval as the oil, and it is not cleanable [1]. A filter that looks clean has usually failed open [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: false · declined: true

The documents do not cover the specifications or type of filter to use, though they state that the filter is changed every 2,000 operating hours or annually (whichever comes first) and is not cleanable [1].

## Run 3 — follow-up — what about the deposit?

Earlier: Can I keep a cat?

> Pets require written consent, which is granted by default for one cat or one dog in properties with private outdoor space [1]. This consent requires an additional deposit equal to one week's rent, which is registered under the same scheme and returned on the same terms [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

The standard deposit is five weeks' rent, which is registered with an approved protection scheme within 30 days of receipt [2]. 

If you keep a cat or dog, that consent carries an additional deposit of one week's rent, which is registered under the same scheme and returned on the same terms [3].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

Consent for a pet carries an additional deposit of one week's rent, which is registered under the same scheme and returned on the same terms [3].

## Run 3 — follow-up — in writing?

Earlier: How much notice must I give to leave?

> After the fixed term, the tenant must give one month's notice ending on a rent payment date [1]. Notice must be in writing [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

Yes, notice must be in writing [7]. A notice served by message or spoken in person has no effect [7].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: false · declined: false

Yes, notice must be in writing [1]. A notice served by message or spoken in person has no effect [1].

## Run 3 — follow-up — how much is it?

Earlier: What can be deducted from the deposit at the end?

> Deductions may be made from the deposit for:
> * Unpaid rent [1]
> * Damage beyond fair wear and tear [1]
> * Professional cleaning, provided the property was professionally cleaned at the start of the tenancy [1]
> 
> Deductions may not be made for redecoration attributable to ordinary use [1].

**rule 7 as of v1.11.0** · cites: true · declined: false

The deposit is five weeks' rent [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

The deposit is five weeks' rent [1].

## Run 3 — follow-up — why?

Earlier: Are resolution times guaranteed for a Severity 3 defect?

> No, resolution targets are deliberately not contractual for Severity 3 tickets [1].

Searched for: Why are resolution targets deliberately not contractual for Severity 3 tickets?

**rule 7 as of v1.11.0** · cites: true · declined: false

Resolution targets for Severity 3 tickets are deliberately not contractual because defects with a workaround are scheduled against the release train rather than a clock, and promising otherwise would mean either missing the promise or shipping a rushed fix [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

Promising resolution times for Severity 3 defects would mean either missing the promise or shipping a rushed fix, as defects with a workaround are scheduled against the release train rather than against a clock [1].

## Run 3 — follow-up — who handles it then?

Earlier: Can a customer escalate a ticket?

> Yes, any ticket may be escalated once by the customer without justification [2]. A second escalation requires a named business impact [2].

**rule 7 as of v1.11.0** · cites: true · declined: false

Escalation moves the ticket to the duty lead, who owns it until closure and cannot reassign it back to the original queue [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: true · declined: false

Escalation moves the ticket to the duty lead, who owns it until closure and may not reassign it back to the original queue [5].

## Run 3 — follow-up — and outside them?

Earlier: What are the coverage hours on a Standard plan?

> On a Standard plan, coverage hours are from 09:00 to 18:00 in the customer's registered timezone, Monday to Friday, excluding public holidays in that country [1].

**rule 7 as of v1.11.0** · cites: false · declined: true

The documents do not cover coverage hours outside of those times, though they do cover response targets, data handling during support, and screen sharing [6][8].

**rule 7 + the earlier-turns sentence (ADR 061)** · cites: false · declined: true

The documents do not cover what happens outside of coverage hours on a Standard plan; they cover coverage hours and availability by support plan tier.

## Run 1 — sequence — the 1.11.0 exit check

Earlier: How much force does the press develop?

> The press develops 90 kilonewtons [1].

### What is the cap on credits in a month?

**rule 7 as of v1.11.0** · unlinked: true · read as a refusal: false

The documents do not cover the amount of force the press develops; they cover Meridian's support policy, including credits, data handling during support, escalations, and ending or downgrading a support plan [1][2][3][4].

**rule 7 + the earlier-turns sentence (ADR 061)** · unlinked: true · read as a refusal: true

The documents do not cover the force developed by a press; they cover Meridian's support policy, including service credits, data handling during support, escalations, and ending or changing a support plan. 

The cap on credits is 25% of the monthly fee in any calendar month [1].

### How long does the deposit take to be protected?

**rule 7 as of v1.11.0** · unlinked: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · unlinked: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## Run 1 — sequence — the demo's starter questions

Earlier: How many days of annual leave do employees get?

> Employees receive 28 days of annual leave plus public holidays [1].

### How many hours a day do I have to overlap with my team?

**rule 7 as of v1.11.0** · unlinked: false · read as a refusal: n/a

You must overlap with your team for at least four hours per day and record those hours in the shared calendar [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · unlinked: false · read as a refusal: n/a

Employees are asked to overlap with their team for at least four hours per day [3].

### Can I put company documents in my personal cloud storage?

**rule 7 as of v1.11.0** · unlinked: true · read as a refusal: n/a

The documents do not cover annual leave or daily team overlap hours, but they do cover data handling and security requirements [1][3]. 

Regarding personal cloud storage, personal accounts may not be used for company work, including cloud storage and note-taking applications [1]. Furthermore, company documents may not be uploaded to third-party services unless they have been approved by the security team [3].

**rule 7 + the earlier-turns sentence (ADR 061)** · unlinked: true · read as a refusal: n/a

The documents do not cover annual leave or team overlap hours. They cover remote work policies, including data handling rules, which state that personal accounts may not be used for company work, including cloud storage [1], and company documents may not be uploaded to unapproved third-party services [3].

## Run 2 — sequence — the 1.11.0 exit check

Earlier: How much force does the press develop?

> The press develops 90 kilonewtons [1].

### What is the cap on credits in a month?

**rule 7 as of v1.11.0** · unlinked: true · read as a refusal: true

The documents do not cover the amount of force the press develops; they cover Meridian's support policies, including service credits, escalation, data handling during support, and ending a support plan. 

Regarding the cap on credits, missing a first response target on a Premier plan is capped at 25% in any calendar month [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · unlinked: false · read as a refusal: false

The cap on credits in any calendar month is 25% of the monthly fee [1].

### How long does the deposit take to be protected?

**rule 7 as of v1.11.0** · unlinked: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · unlinked: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

## Run 2 — sequence — the demo's starter questions

Earlier: How many days of annual leave do employees get?

> Employees receive 28 days of annual leave plus public holidays [1].

### How many hours a day do I have to overlap with my team?

**rule 7 as of v1.11.0** · unlinked: false · read as a refusal: n/a

You are asked to overlap with your team for at least four hours per day [3].

**rule 7 + the earlier-turns sentence (ADR 061)** · unlinked: false · read as a refusal: n/a

Employees are asked to overlap with their team for at least four hours per day [3].

### Can I put company documents in my personal cloud storage?

**rule 7 as of v1.11.0** · unlinked: true · read as a refusal: n/a

The documents do not cover annual leave or daily team overlap hours, but they do state that personal accounts, including cloud storage and note-taking applications, may not be used for company work [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · unlinked: true · read as a refusal: n/a

The documents do not cover how many days of annual leave employees get. They cover remote work policies, including travel, data handling (prohibiting personal accounts and unapproved third-party services for company work), equipment return upon leaving, and laptop encryption [1][2][3].

## Run 3 — sequence — the 1.11.0 exit check

Earlier: How much force does the press develop?

> The press develops 90 kilonewtons [1].

### What is the cap on credits in a month?

**rule 7 as of v1.11.0** · unlinked: false · read as a refusal: false

The cap on credits in any calendar month is 25% [1].

**rule 7 + the earlier-turns sentence (ADR 061)** · unlinked: true · read as a refusal: true

The documents do not cover how much force a press develops, but they do cover service credits, escalation, data handling during support, and ending a support plan [1][2][3][4].

The cap on credits is 25% of the monthly fee in any calendar month [1].

### How long does the deposit take to be protected?

**rule 7 as of v1.11.0** · unlinked: false · read as a refusal: false

The deposit is registered with an approved protection scheme within 30 days of receipt [1][2].

**rule 7 + the earlier-turns sentence (ADR 061)** · unlinked: false · read as a refusal: false

The deposit must be registered with an approved protection scheme within 30 days of receipt [1][2].

## Run 3 — sequence — the demo's starter questions

Earlier: How many days of annual leave do employees get?

> Employees get 28 days of annual leave plus public holidays [1].

### How many hours a day do I have to overlap with my team?

**rule 7 as of v1.11.0** · unlinked: false · read as a refusal: n/a

Employees are asked to overlap with their team for at least four hours per day [3].

**rule 7 + the earlier-turns sentence (ADR 061)** · unlinked: false · read as a refusal: n/a

You are asked to overlap with your team for at least four hours per day and record those hours in the shared calendar [1].

### Can I put company documents in my personal cloud storage?

**rule 7 as of v1.11.0** · unlinked: true · read as a refusal: n/a

The documents do not cover annual leave or daily team overlap hours; they cover remote work policies such as equipment return, travel expenses, data handling, and full-disk encryption requirements [1][2][3].

**rule 7 + the earlier-turns sentence (ADR 061)** · unlinked: true · read as a refusal: n/a

The documents do not cover annual leave or team overlap hours; they cover remote work policies such as equipment return, travel expenses, data handling, and security requirements.

Regarding your question about cloud storage, personal accounts may not be used for company work, including cloud storage and note-taking applications [1]. Additionally, company documents may not be uploaded to third-party services that have not been approved by the security team [3], and documents classified as restricted may not leave company-managed devices at all [2].
