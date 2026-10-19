# AS Sales App

An internal Authority Solutions tool that takes a lead from web form to signed deal on top of GoHighLevel, with AI doing the checking and the paperwork. A rep works entirely in the app and never opens GoHighLevel. The app has no product name; the Authority Solutions logo stands in for one.

## Language

### People

**Rep**:
A salesperson who works leads in the app. Sees their own assigned leads; invoices and recordings are read-only. The screen registry calls this persona "operator".
_Avoid_: Agent, seller, staff, operator (in copy)

**Admin**:
Zachery and Mitchell, and whoever they make admin. Sees every lead and the admin screens, and approves invoices.
_Avoid_: Owner, manager

**Profile**:
The app's record of one person who may sign in: email, name, role, active or not. Created by an admin before the person's first sign-in.
_Avoid_: User account, member

### Leads and the pipeline

**Lead**:
One prospect, held in GoHighLevel as a contact with an opportunity, and copied into the app.
_Avoid_: Contact (in copy), prospect, deal

**Stage**:
Where a lead's card sits in the New Lead Pipeline: New Lead, Discovery Call Booked, Qualified, Proposal Review Booked, Proposal Sent, Lead Won, Lead Lost or Nurturing.
_Avoid_: Step, column

**Lead Status**:
Why the lead is where it is: one of 28 values in GoHighLevel's Lead Status field (for example Awaiting Confirmation, No Show, Proposal No Win), in seven groups.
_Avoid_: Sub-stage, state

**Silence path**:
What happens when a lead goes quiet: did not book, cancelled, rescheduled, no-show, Nurturing, Lost.

**Booking**:
A scheduled call: a discovery call or a proposal review, made on a GoHighLevel calendar.
_Avoid_: Appointment (in copy), meeting (for the booking itself)

**Write**:
One change the app sends to GoHighLevel (W1 to W6 in the connector spec). Every write is logged.
_Avoid_: Sync, push

**Sync log**:
The record of every write and every attempt. The visible seam between the app and GoHighLevel.

### Checking a lead

**Verdict**:
The AI's judgment of a new lead: Valid, Suspect or Spam.
_Avoid_: Score, rating

**Suspect**:
The verdict that means the AI is unsure; a rep decides, in the review queue.

**Research brief**:
What the AI found about a lead's business (site, rankings, competitors), shown to the rep and written to GoHighLevel with the verdict.

### Working a lead

**Deck**:
A presentation generated for a lead from one of three groups: Discovery Call, Follow Up, Strategy Session. Its last slide carries the booking calendar.
_Avoid_: Slides, presentation

**Meeting**:
A recorded call from Fathom, matched to a lead and a booking, with its transcript and notes.
_Avoid_: Recording (for the whole thing), call notes

**Transcript**:
The words of a meeting, by speaker. Feeds the proposal.

**Proposal**:
The priced offer, built in the app from the transcript and created in Smart Pricing Table, which the lead signs there.
_Avoid_: Quote, contract

**Invoice pair**:
The two invoices drafted when a proposal is signed: a one-time upfront invoice and a monthly recurring one. An admin approves and sends them.
_Avoid_: Bill

**Notification**:
An in-app alert for a person that links to what needs them.
_Avoid_: Alert, message
