# Repository diagrams for debugging

Use this reference when authoring a new repository explanation. The default is a
readable diagram with enough implementation detail to trace a real operation,
plus a companion `debugging.md`. An explicit request for a quick overview,
diagram-only output, or a specific diagram type controls the result. A frozen
candidate still uses the existing handoff path; do not expand it without a
request to change its meaning.
For a quick overview or diagram-only request, omit the companion guide and extra
diagrams unless requested. Keep an explicitly fixed diagram type; use its cards
and the guide for further detail rather than adding another type.

## Follow the operation, not just the services

Apply [Repository authoring](repository-authoring.md) to freeze the revision and
gather evidence while reading a connected slice. Start with the user's symptom
or named operation; otherwise choose the repository's main runtime journey and
state that scope. Follow the path far enough to explain the observable result:

- The real entry point: route/method, event/command, scheduled job, or exported
  library operation, and the input it receives.
- Validation and authorization gates, dispatch, handler/service calls, and the
  actual reader or writer of a file, cache, database, or queue.
- The important data passed between those steps: a request field, state/key,
  table or file, emitted event, or returned result when the code establishes it.
- Material branches: rejected input, cache hit/miss, empty results, dependency
  failures, retries/timeouts, cancellation, cleanup, and error propagation or
  swallowing. Include the applicable branches found in this slice; do not add
  conventional infrastructure or recovery mechanisms that are absent.
- Existing observability useful at those steps: log messages, event names,
  correlation fields, error codes, and configuration keys that change behavior.
  Show key names and meaning rather than credentials or secret values.

Keep the units that explain control, state, I/O ownership, or the symptom
distinct. A module boundary or every discovered helper is not automatically a
new node. Read callees and actual catch/write sites before assigning failure or
persistence behavior; a caller's name alone does not prove it. Static source
inspection establishes possible behavior, not that a particular request ran or
that the cause of an incident is confirmed.

## Put useful detail in supported fields

Read the selected schema and common definitions before authoring new fields.

- **Architecture:** use recognizable component labels, short operation or
  endpoint sublabels, and concise action/data/condition labels on connections.
  Keep important gates on the affected relationship or node. Use real, evidenced
  boundaries. Put supporting implementation and observation facts in `cards`.
- **Workflow:** use v2 lanes/nodes/edges for conditional control flow. The
  `mainPath` identifies the happy path; `edges[].role` can distinguish `branch`,
  `error`, `async`, and `return` when those semantics are established. Express
  failure paths and retry conditions as connected topology.
- **Sequence:** show the ordered calls and responses of the selected scenario.
  Use `messages[].note` for a relevant internal operation or condition, and
  `variant: "return"` for real return messages. Mutually exclusive success and
  failure outcomes must not appear as one unconditional execution. Self-message
  loops are unsupported; use a note or a focused Workflow for internal branches.
- **Other modes:** retain the type requested and its semantics. Debugging detail
  can describe a pipeline's transformation/failed stage, a state's exit guard,
  a table's keys, or a class's callable contract without converting it into
  Architecture.

Source references belong to primary nodes/participants/states/entities/types,
not relationships or messages. Each primary element accepts at most three
`sources` ranges using `path`, `line`, optional `end_line`, and optional `label`.
For a relationship, cite the actual caller, writer, or transition owner on that
owning element. Keep additional exact references in `debugging.md`; do not cite
one nearby startup range for all downstream claims.

Cards contain plain-text items. They can identify an operation's role, an
existing log/correlation field, a failure condition, or a suggested inspection
point. Markdown/HTML links in a card will not become clickable; use native node
source links for code navigation. Do not add invented `details`, `debug`, edge
`sources`, or other fields. `meta.views` is retired and ignored, even though it
remains accepted for compatibility; do not use it for new detail views.

Preserve readable typography and route labels. Move a long explanation into a
card or the companion guide instead of squeezing it into a box. Prefer a
focused diagram of a complex mechanism over an enormous architecture canvas.
When the requested architecture needs a separate Sequence or Workflow, keep the
shared component names consistent and finalize each artifact with repository
evidence. Add one only when it resolves an actual readability or coverage need;
there is no required number of boxes, cards, or diagrams.

## Write the companion debugging guide

Create `debugging.md` beside the candidate and HTML from the same inspected
evidence. Make it a practical route into the code rather than a duplicate of
every label. Include the sections that have meaningful content:

1. **Scope and evidence:** the selected operation/symptom and pinned revision.
   State whether this is static inspection or supplied runtime evidence. Follow
   the repository contract for dirty worktrees; never cite uncommitted bytes as
   evidence for the recorded commit.
2. **Execution walkthrough:** ordered steps from entry to result. For each,
   identify the owning module/function, input/output or state change, important
   guard, and exact source location. Use clickable commit-pinned source links
   for a supported web origin, or absolute local file links with line numbers
   for local-only evidence. When a worktree differs from the pinned revision,
   local links must point into the clean checkout used for evidence, not the
   changed worktree. Quote the function, route, or key name accurately.
3. **Where to investigate:** connect the relevant symptom or branch to its
   observed failure behavior, an exact inspection location, and a useful value
   or existing signal to check. Suggested breakpoints are suggestions, not
   existing instrumentation. Do not label a static failure possibility as the
   confirmed cause of a real incident.
4. **Data and configuration:** identify relevant store/table/file ownership,
   configuration keys, retry/timeout values with units, or correlation fields
   when they affect this path. Reference the source instead of copying secrets.
5. **Unknowns:** distinguish behavior established by source, facts supplied by
   the user, proposed checks, and things not established by the inspected slice.
   "No retry found in this inspected path" is different from a claim that the
   whole project has no retry behavior. Leave out empty checklist sections.

Keep code references consistent with the diagram and the pinned revision. Run
the normal `finalize` gates for each HTML artifact; a useful debugging guide does
not replace schema, provenance, layout, or real-browser validation.

## Handoff

For detailed repository output, link the HTML and `debugging.md` in the final response. Mention the
scope and any uncertainty that changes how the result should be read. Reader
search, Focus, upstream/downstream exploration, Route Probe, and native source
links already support navigation through the authored facts; describe a useful
action when it helps this particular user. Those graph relationships are not
runtime traces or proof of impact.

Re-author older diagrams to gain the richer information. Moving boxes changes
layout, not the underlying source analysis or debugging detail.
