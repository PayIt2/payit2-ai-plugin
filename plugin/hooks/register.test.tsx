import { expect, test } from 'claude-code/testing'

const OUTPUT =
  '## Campaign Created: Help Jordan\n**URL:** https://collect.payit2.com/fund/xkg5aqs\n**Status:** draft\n**Goal:** $5,000'

// What get_campaign_overview answers today (no page link), and the same with the "**URL:**" line
// create_campaign already sends, which the PayIt2 server has yet to add to it.
const OVERVIEW =
  '## Campaign: Spring Fund\n**ID:** cmp_123\n**Status:** active\n**Slug:** sw9gsvg\n### Fundraising Progress\n**Raised:** $1,250 of $15,000 goal\n**Participants:** 12'
const OVERVIEW_WITH_URL = `${OVERVIEW}\n**URL:** https://collect.payit2.com/fund/sw9gsvg`

const CREATED = { mode: 'fundraiser', blurb: 'Helping Jordan recover.', goalAmount: 5000 }

const row = (
  surface: 'terminal' | 'desktop' | 'mobile',
  tool: string,
  output: unknown,
  input: Record<string, unknown> = CREATED,
) =>
  ({
    plugin: 'payit2',
    surface,
    component: 'ToolUse',
    props: {
      tool_use_id: 't1',
      tool,
      input,
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
      output,
    },
  }) as const

for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
  test(`${surface}: a created campaign gets a page preview`, async $ => {
    const ui = await $.ui.mount(row(surface, 'mcp__PayIt2__create_campaign', OUTPUT))

    expect(await ui.find({ type: 'Link' })).toBeDefined()
    expect(await ui.find({ type: 'Button' })).toBeDefined()
    expect(await ui.find({ text: /\$0 raised of \$5,000/ })).toBeDefined()
    expect(await ui.find({ text: /Helping Jordan recover/ })).toBeDefined()
    await ui.unmount()
  })

  test(`${surface}: a looked-up campaign with a page link shows its title and what it raised`, async $ => {
    const ui = await $.ui.mount(
      row(surface, 'mcp__PayIt2__get_campaign_overview', OVERVIEW_WITH_URL, { campaignId: 'cmp_123' }),
    )

    expect(await ui.find({ type: 'Link' })).toBeDefined()
    expect(await ui.find({ text: /Spring Fund/ })).toBeDefined()
    expect(await ui.find({ text: /\$1,250 raised of \$15,000/ })).toBeDefined()
    expect(await ui.find({ text: /active/ })).toBeDefined()
    await ui.unmount()
  })

  test(`${surface}: a looked-up campaign with no page link gets no card, and no guessed link`, async $ => {
    const ui = await $.ui.mount(
      row(surface, 'mcp__PayIt2__get_campaign_overview', OVERVIEW, { campaignId: 'cmp_123' }),
    )

    expect(await ui.find({ type: 'Link' })).toBeUndefined()
    await ui.unmount()
  })

  test(`${surface}: other tools and link-free results are left alone`, async $ => {
    const other = await $.ui.mount(row(surface, 'Bash', OUTPUT))
    expect(await other.find({ type: 'Link' })).toBeUndefined()
    await other.unmount()

    const plain = await $.ui.mount(row(surface, 'mcp__PayIt2__list_my_campaigns', 'no link'))
    expect(await plain.find({ type: 'Link' })).toBeUndefined()
    await plain.unmount()
  })
}
