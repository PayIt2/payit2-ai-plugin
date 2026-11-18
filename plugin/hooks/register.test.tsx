import { expect, test } from 'claude-code/testing'

const OUTPUT =
  '## Campaign Created: Help Jordan\n**URL:** https://collect.payit2.com/fund/xkg5aqs\n**Status:** draft\n**Goal:** $5,000'

const row = (surface: 'terminal' | 'desktop' | 'mobile', tool: string, output: unknown) =>
  ({
    plugin: 'payit2',
    surface,
    component: 'ToolUse',
    props: {
      tool_use_id: 't1',
      tool,
      input: { mode: 'fundraiser', blurb: 'Helping Jordan recover.', goalAmount: 5000 },
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

  test(`${surface}: other tools and link-free results are left alone`, async $ => {
    const other = await $.ui.mount(row(surface, 'Bash', OUTPUT))
    expect(await other.find({ type: 'Link' })).toBeUndefined()
    await other.unmount()

    const plain = await $.ui.mount(row(surface, 'mcp__PayIt2__list_my_campaigns', 'no link'))
    expect(await plain.find({ type: 'Link' })).toBeUndefined()
    await plain.unmount()
  })
}
