# Architecture and complete API Sequence coverage

Use this reference for newly authored repository explanations. The deliverables
are an Architecture map and API Sequence diagrams. Do not create a debugging
document or another prose report. Keep source links, coverage, conditions, and
important unknowns inside the diagrams and their supported cards. Candidate JSON
and normal verification receipts remain necessary supporting files.

An explicit narrower scope, single diagram, different mode, or frozen-candidate
handoff controls that request. Otherwise inspect the whole codebase's API surface,
not just a representative journey. A request for concise detail can simplify
labels and cards; it does not silently remove APIs from the requested coverage.

## Discover the complete API surface

Apply [Repository authoring](repository-authoring.md) to pin repository identity
and inspect committed evidence. For a whole-project request, extend its connected
slice approach to every first-party API entry point across packages/services:

- Follow application bootstraps, router/controller registration, mounted routers,
  framework route files, version/base prefixes, and registration loops. Resolve
  effective paths and methods; the same path with different methods is a separate
  endpoint. Include health, auth, administrative, internal, and webhook endpoints
  when registered, rather than choosing only business routes.
- Include other exposed API forms present in the project: GraphQL root operations,
  RPC methods, or WebSocket message handlers. Name the protocol/operation instead
  of inventing HTTP methods for them. Separate inbound APIs from outbound calls to
  external APIs; trace the latter as dependencies of their real callers.
- Check deployment/feature configuration and conditional registration. Distinguish
  active, conditional, and unavailable routes. Do not count an unregistered helper
  as an exposed endpoint. Reconcile route/spec declarations with actual wiring;
  a stale API specification alone does not establish an implemented handler.
- Keep an internal inventory mapping service, protocol/method, effective path or
  operation, registration and handler locations, gating condition, and destination
  Sequence. This can stay in working context; do not emit a separate inventory
  report. Resolve each entry through its handler, meaningful service calls, actual
  reader/writer or external dependency, and returned response or error.

Search is a way to locate registrations, not proof of completeness. Follow mounts
and imports, including generated or dynamic registration where source permits.
Do not run the application, call live endpoints, or generate credentials just to
discover routes. If missing code, unresolved dynamic registration, or configuration
prevents complete enumeration, name the exact gap in a diagram card and the final
reply; do not claim all APIs are covered. Source inspection establishes possible
behavior rather than proving a live request or incident occurred.

## Architecture deliverable

Show the codebase's actual runtime components, API entry surfaces, meaningful
control/service roles, data stores, queues, external dependencies, and evidenced
boundaries. Keep component names consistent with Sequence participants. Retain
implementation detail that explains control, state, and I/O ownership without
turning every route or helper into an Architecture box.

Use concise action/data/condition labels, recognizable operation sublabels, native
node source links, and supported cards. Important authorization, failure, retry,
timeout, and asynchronous behavior belongs beside its real owner when established
by source. Do not infer conventional infrastructure or recovery from names alone.

## Sequence deliverable

Read `schemas/sequence.schema.json`, the common schema, Authoring defaults, and
the routed Sequence example before authoring. Cover each inventoried API with an
actual request-to-response trace: caller, entry/dispatch, applicable validation or
authorization, handler/service operation, I/O or external call, and response.
Preserve method plus effective path or operation in the scenario label or request
message. A coverage list or a generic "CRUD" arrow does not replace endpoint
traces. Shared implementation can be summarized consistently, but each API's
entry, material differences, and result must remain visible.

One Sequence may contain independent API scenarios using named `segments` with
disjoint vertical ranges. State in its subtitle/card that these are independent
requests, not consecutive steps in one transaction. Each segment has its own
request and completion; do not connect different scenarios or carry activations
across them. Use actual return messages with `variant: "return"`. Preserve
conditions in concise message notes or a separate named scenario, so mutually
exclusive success and failure do not appear as an unconditional execution.
Sequence has no `alt`, `opt`, or `loop` construct, and self-message loops are
unsupported; do not invent schema fields or use retired `meta.views` to add them.

Prefer one Sequence HTML when all API traces remain readable. If it becomes too
wide/tall or citations cannot accurately support the participants, split by API
area or endpoint into additional Sequence HTML files. These remain the Sequence
deliverable; do not add other diagram types or prose documents. Every API still
needs a trace in one of them. Reuse consistent component names and finalize each
artifact. Follow the Sequence width review when the receipt requests it.

Reconcile the inventory against the authored scenarios before delivery: every
discovered endpoint must map to a Sequence scenario, with conditional/unresolved
status retained. Add concise coverage cards to the Sequence output identifying
its methods/paths or operations and any gaps. Do not cite an inspection limit as
complete coverage or squeeze a missing flow into an unlabeled summary arrow.

## Evidence and handoff

Architecture components and Sequence participants carry native `sources`, at
most three exact ranges per element. Cite the actual caller, writer, or return
owner; messages and relationships do not accept `sources`. If grouping would
exceed accurate participant evidence, use focused Sequences rather than one
nearby source range for unrelated claims. Cards are plain text; use native node
source links for clickable code locations. Keep secrets out of labels and cards.

When the repository exposes no APIs, state that finding and show its evidenced
main execution flow as the Sequence deliverable. Do not invent a server/API. If
the inspected source cannot establish a meaningful cross-participant flow, state
that limitation instead of fabricating messages to satisfy the schema.

Use a new request folder for the pair, with separate `architecture/` and
`sequences/<area-or-endpoint>/` subfolders when useful. Each finalized diagram
keeps its own candidate, HTML, and evidence paths. Run the normal `finalize` gates
with the same pinned revision for every diagram. Link the Architecture and all
Sequence HTML outputs in the final response, and mention only material coverage
gaps or evidence limits. Do not link a debugging guide or generate a prose report.

Existing HTML must be re-authored for the revised output. Moving boxes changes
layout, not API coverage or source analysis.
