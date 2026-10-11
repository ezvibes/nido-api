# Beehiiv MCP Draft And Editorial Playbook

Use this reference when a connected Beehiiv MCP is available for creating,
reviewing, or updating newsletter drafts. Discover current tool schemas and
authoring contracts; the examples below are workflow guidance, not a frozen API.

## Scope And Authority

An editor's explicit request to create or update a Beehiiv draft authorizes that
bounded staging action. Keep that authorization across follow-up edits; do not
ask again for each paragraph. A request for a local draft for review does not
authorize an external push. Never publish, schedule, send, contact venue owners,
or change a shared website component as an incidental part of draft work.

This connected-editor workflow is separate from the Nido runtime. The current
`src/newsletter/beehiiv.service.ts` creates drafts through the API; documenting
MCP editing does not add that capability to the application or ADK runtime.

## Five Steps For A New Or Existing Draft

1. **Identify and read.** Resolve the publication and post using the supplied
   editor URL and current tool results. Use `list_publications` if identity is
   unknown, then `get_post` for metadata and `get_post_content` with
   `format: editor_html` for the body. Confirm draft status, intended audience,
   title, sponsors and existing content. Never guess a publication ID or copy
   one from a previous task.
2. **Prepare locally.** Save a readable draft, source notes and a before-edit
   snapshot when replacing substantial content. Separate verified source facts,
   editorial interpretation and the editor's firsthand memories. Show a concrete
   reviewable result when the editor has requested review before staging.
3. **Use the right write tool.** Create with `save_post`; update metadata with
   `edit_post`; edit body blocks with `edit_post_content`. Read
   `learn_post_authoring` and `learn_post_metadata` for the shapes needed. For a
   structured template, create from the template without appending the article
   below its footer, then replace its body placeholders using block edits.
4. **Apply a bounded patch.** Target the current `data-node-hash` values. Batch
   compatible operations atomically, preserving unrelated editor changes and
   managed blocks. If a hash is stale, reread and rebuild the patch. Returned
   hashes replace old ones. Use partial metadata patches; `recipients` replaces
   BOTH audiences, so include both channels if changing it. Synchronize an
   approved title change across the headline, post title, email subject and
   search/social titles; keep the slug unless changing the URL is requested.
5. **Read back and review.** Confirm the saved title/settings, draft status and
   lack of scheduling. Check venue/section counts, links, image, sponsor blocks,
   personal tips, placeholder text, malformed ranges and layout. Keep the local
   draft consistent. Report what was saved separately from rendering, visitor
   access or link behavior that remains unverified.

## Preserve What The Editor Already Built

- Prefer incremental block edits over whole-document replacement. A whole-body
  rewrite can erase intervening edits or fail on editor-managed nodes.
- Some nodes are not authorable. `advertisementOpportunityLogo` was rejected by
  the authoring contract in the observed session; leave existing logo blocks
  untouched and use supported operations around them.
- Replacing or deleting an `advertisementOpportunity` can release the ad. Do not
  move, remove, repoint or rewrite sponsor creative during unrelated copy edits.
  Read current ad deadlines before a publication handoff; never assume an old
  placement is still eligible.
- Reuse authentic venue images from the publication's media library, with
  meaningful alt text and captions. Use the canonical uploaded asset URL and
  image-block contract. Do not substitute an AI image for a real venue photo.
- Identical blocks can share a hash, including separators. Do not assume a hash
  uniquely identifies one duplicate; inspect and verify before deleting it.
- A tool success is evidence of a saved draft, not proof of the email/mobile
  layout. Use an appropriate visual preview before calling the layout reviewed.
- If automatic approval review rejects a mutation, explain the stated reason.
  Do not bypass it by changing tools, fragmenting the same rejected action, or
  relabeling it. Continue unaffected work and request the missing authorization
  only when needed.

## Subscriber Growth And Gates

For a free email gate, use `edit_post` with
`email_capture_type_override: gated`. This differs from a dismissible signup
popup and a paid-subscriber paywall. Preserve the existing audience unless the
editor explicitly changes it.

For a teaser followed by subscriber content, the observed authoring contract
supports a native positional marker:

```html
<div class="node-subscriberBreak"></div>
```

Place it after the public introduction and before the guide, then read back the
canonical body to confirm it persisted. Rediscover the contract before reuse.
Never infer that persistence proves visitor enforcement.

Verification has three distinct levels:

- **Saved:** metadata says `gated`, and the subscriber-break node is present.
- **Previewed:** an anonymous preview stops at the teaser while a free
  subscriber can read the guide. Inspect actual behavior, not just the setting.
- **Live:** a logged-out visitor to the published post encounters the signup
  gate; a signed-in subscriber gets access. This requires a human publication
  step and a subsequent access check.

In the observed session, MCP `text` previews for `non_subscriber`, `free` and
`everyone` returned identical full text despite the saved subscriber break.
Treat that preview as insufficient evidence of enforcement, not proof that the
live gate works or fails. Do not promise that a saved gate blocks search or AI
crawlers, guarantees discoverability, or guarantees subscriber conversion.

The Advanced Website Builder also has a shared Content Gate Popup. Its popup
component is separate from an inline page `contentGate`; a
`get_content_gate` result of `has_content_gate: false` does not establish that
the post popup is absent. Inspect the actual Post page's Layers > Popups when
needed. A draft popup is not a published popup. Shared website publication needs
separate, scoped authorization and must not be bundled into a post draft update.

Reference: [Beehiiv's content-gate setup and per-post overrides](https://www.beehiiv.com/support/article/38217744316823).

## EZ Vibes Bonus-Guide Voice

The editor's preferred venue feature format is:

```markdown
### Venue Name — City

A short paragraph describing what a night here feels like: the setting,
food/drinks, room size, views, seating or standing, and characteristic acts.
Include an actual firsthand tip when supplied by the editor.

📍 Street address, City · [Google Maps](verified-map-url)
🎟️ [Shows & venue info](verified-venue-url)
```

Choose the details that distinguish the venue; do not mechanically fill every
category or invent missing details. Include exact capacity only when supported
by a current source. Describe seated/standing formats as experiences rather
than repeating door policies. Keep general event-policy advice in one short
introductory section and retain only material venue-specific exceptions.

Avoid repetitive `Find it`, `Plan the visit` and `Useful tip` labels, generic
hype, unsupported price bands, and source-link clutter inside each feature.
Keep research/provenance in editorial notes; retain the useful map and venue
links in the article. A reachable website is not proof its event claims are
correct. Research current venue facts using primary sources where possible.

Use only memories actually provided by the editor. Their Haw River tip about
sunset, the neighboring taproom, parking and the second-floor patio, and their
Bowstring observations about food and indoor/outdoor music, improved the guide
without invented attendance. Do not copy those details onto other venues.

Keep venue guides separate from TPS2 event curation: official venue research and
editor memories can support a guide; concert selections still require active,
admin-approved Nido evidence.

The editor wants at least one monthly bonus guide, with venue and regional
guides as useful directions after the festival guide. Use the saved editorial
plan to choose the next topic. This preference authorizes planning, not automatic
publication or a duplicate recurring automation. Venue-owner outreach and
sponsored-feature pitches remain separate work requiring explicit send authority.

## Observed Learning Record

- **Status:** Applied guidance; live MCP draft editing verified for the named
  operations, subscriber-gate enforcement unverified.
- **Observed:** October 11, 2026, connected Beehiiv MCP in an editor-led session.
- **Evidence:** The Triangle Live Music Venue Guide draft saved 24 revised venue
  features and 24 map links, removed placeholder copy and malformed pricing,
  preserved sponsors and a venue photo, and synchronized its title/subject.
  The native subscriber break and `gated` setting persisted; audience text
  previews did not distinguish access.
- **Change:** This playbook is linked from Firenze's canonical skill and guide.
- **Verification:** Documentation, link and whitespace checks apply to this
  instruction update. No application behavior was changed or deployed.
- **Revisit:** Recheck tool contracts on reuse; update the gate evidence after
  an authorized anonymous-web test, and assess whether later drafts require
  fewer editorial corrections before claiming a measured quality improvement.
