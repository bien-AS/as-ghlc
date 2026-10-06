# Dealwright

A sales workspace that takes a lead from web form to signed deal, with AI doing the checking and the paperwork. A rep works entirely in the app and never opens the CRM behind it.

## Language

### The product

**Dealwright**:
The product's public name, shown as "Dealwright by Authority Solutions" while it is early. Internally it is called ASCRM, which never appears in anything a user sees.
_Avoid_: ASCRM (in user-facing text), the CRM, Sales App

### People and customers

**Workspace**:
One customer of the product. Users, leads and connections belong to a workspace.
_Avoid_: Tenant, account, organisation

**User**:
A person who signs in to the app.
_Avoid_: Member, account

**Rep**:
A person on a sales team who works leads in the app.
_Avoid_: Salesperson, agent, seller

**CRM**:
The customer's own system of record for contacts, forms, calendars and sequences, which sits behind the app and is never named to a rep.
_Avoid_: Backend, the engine

### Leads and the pipeline

**Lead**:
The record of one prospect, held by the app. A lead never signs in.
_Avoid_: Contact, prospect, opportunity, deal

**Owner**:
The rep a lead is assigned to.
_Avoid_: Assignee

**Pipeline**:
The six stages a lead moves through in order, together with the three exits.
_Avoid_: Funnel, board

**Stage**:
A lead's position in the pipeline: New lead, Discovery Call Booked, Qualified, Proposal Review Booked, Proposal Sent or Lead Won.
_Avoid_: Step, phase, column

**Status**:
A finer description of where a lead stands inside its stage, shown as one line to the rep.
_Avoid_: State, sub-stage

**Exit**:
One of the three ways a lead leaves the pipeline before winning: Spam, Nurture or Lead Lost.
_Avoid_: Closed, archived, dead

**Nurture**:
The exit for a lead that has gone quiet, after which another team takes over.
_Avoid_: Drip, cold

**Booking**:
A scheduled call with a lead, either a discovery call or a proposal review.
_Avoid_: Appointment, meeting, session

**Activity**:
One entry in a lead's timeline, recording something a user, the system or the CRM did.
_Avoid_: Event, log entry, write

**Notification**:
An in-app alert for a user that links to a lead.
_Avoid_: Alert, message

### Checking a lead

**Verdict**:
The AI's judgment of whether a lead is genuine: valid, suspect or spam.
_Avoid_: Score, validation status, rating

**Suspect**:
A verdict that means the AI is unsure, so a rep must decide.
_Avoid_: Flagged, pending

### Working a lead

**Deck**:
A presentation generated for a lead, which the rep presents on a call and sends afterwards.
_Avoid_: Slides, presentation

**Proposal**:
The priced offer a rep builds and sends to a lead, which the lead signs to win the deal.
_Avoid_: Quote, estimate, contract

### Connecting services

**Adapter**:
The part of the app that holds everything specific to one CRM and meets the one contract every CRM is connected through.
_Avoid_: Gateway, integration, connector

**Connection**:
A workspace's link to one external service.
_Avoid_: Integration, credential
