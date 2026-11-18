import type { Register } from 'claude-code'

const PAYIT2_TOOL = /payit2/i
const CAMPAIGN_URL = /https:\/\/(?:collect|www)\.payit2\.com\/[^\s)"'<>\\]+/
const TITLE = /## Campaign(?: Created| Updated| Health)?: ([^\n\\]+)/
const STATUS = /\*\*Status:\*\* ([a-z_]+)/i
const KIND = /\*\*Type:\*\* ([^\n\\]+)/
const GOAL = /\*\*Goal:\*\* \$([\d,]+(?:\.\d+)?)/
const RAISED = /\$([\d,]+(?:\.\d+)?)\s*\/\s*\$([\d,]+(?:\.\d+)?)/
// get_campaign_overview and get_campaign_health: "**Raised:** $1,250 of $15,000 goal".
const RAISED_OF = /\*\*Raised:\*\* \$([\d,]+(?:\.\d+)?) of \$([\d,]+(?:\.\d+)?) goal/
const GREEN = '#799A3D'
const THEME = /\*\*Theme:\*\* `?([a-z-]+)/
const HEX = /^#[0-9A-Fa-f]{6}$/
// The 12 presets list_theme_presets returned on 2026-11-18: display title and primary color.
// A copy, so a preset PayIt2 adds or recolors later shows in PayIt2 green until it is added here.
const THEMES: Record<string, { title: string; color: string }> = {
  'classic-green': { title: 'Classic Green', color: GREEN },
  'legal-defense': { title: 'Legal Defense', color: '#1E3A5F' },
  memorial: { title: 'Memorial', color: '#5C7160' },
  wedding: { title: 'Wedding', color: '#B89968' },
  reunion: { title: 'Reunion', color: '#C2853F' },
  'sports-team': { title: 'Sports Team', color: '#C53030' },
  birthday: { title: 'Birthday', color: '#D946A0' },
  'charity-walk': { title: 'Charity Walk', color: '#0D9488' },
  school: { title: 'School / Class', color: '#1D4ED8' },
  faith: { title: 'Faith Community', color: '#6B21A8' },
  medical: { title: 'Medical / Health', color: '#0F766E' },
  animal: { title: 'Animal / Pet', color: '#B45309' },
}
const KINDS: Record<string, string> = {
  fundraiser: 'Fundraiser',
  registration: 'Event',
  group_payment: 'Group payment',
}

/** Every string inside a tool result, whatever shape the connector gave it. */
const textOf = (value: unknown, depth = 0): string => {
  if (typeof value === 'string') {
    return value
  }

  if (value === null || typeof value !== 'object' || depth > 6) {
    return ''
  }

  return Object.values(value)
    .map(inner => textOf(inner, depth + 1))
    .join('\n')
}

const field = (input: unknown, name: string): unknown =>
  input !== null && typeof input === 'object'
    ? (input as Record<string, unknown>)[name]
    : undefined

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

const dollars = (value: string | undefined): number | undefined => {
  const amount = value === undefined ? Number.NaN : Number(value.replace(/,/g, ''))

  return Number.isFinite(amount) ? amount : undefined
}

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`

export const register: Register = on => {
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const { tool, input, isRunning, isErrored, output } = e.props

    if (!PAYIT2_TOOL.test(tool) || isRunning || isErrored) {
      return next(e)
    }

    const result = textOf(output)
    const url = CAMPAIGN_URL.exec(result)?.[0]

    if (url === undefined) {
      return next(e)
    }

    // What the page shows, from what the call sent and what PayIt2 answered.
    const title =
      text(TITLE.exec(result)?.[1]) ?? text(field(input, 'title')) ?? 'Your PayIt2 page'
    const blurb = text(field(input, 'blurb'))
    const status = STATUS.exec(result)?.[1]?.toLowerCase()
    const kind =
      KINDS[String(field(input, 'mode'))] ?? text(KIND.exec(result)?.[1]) ?? 'Campaign'
    const raisedOf = RAISED_OF.exec(result) ?? RAISED.exec(result)
    const inputGoal = field(input, 'goalAmount')
    const goal =
      dollars(raisedOf?.[2]) ??
      dollars(GOAL.exec(result)?.[1]) ??
      (typeof inputGoal === 'number' ? inputGoal : undefined)
    const raised = dollars(raisedOf?.[1]) ?? 0
    const isLive = status !== undefined && status !== 'draft'
    // The page's theme: the preset the call set or PayIt2 named, and the accent the call set over it.
    const theme = THEMES[text(field(input, 'themeId')) ?? THEME.exec(result)?.[1] ?? '']
    const accent = text(field(input, 'themeAccentColor'))
    const color = accent !== undefined && HEX.test(accent) ? accent : (theme?.color ?? GREEN)

    const { Box, Text, Link, Button, Progress } = $.ui.resolve(e)
    const row = await next(e)

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
        {row}
        <Text dimColor>
          PayIt2 {kind}
          {status !== undefined && (isLive ? ` · ${status}` : ' · draft, not live yet')}
          {theme !== undefined && ` · ${theme.title} theme`}
        </Text>
        <Text bold color={color}>
          {title}
        </Text>
        {blurb !== undefined && <Text>{blurb}</Text>}
        {goal !== undefined && goal > 0 && (
          <Progress
            label={`${money(raised)} raised of ${money(goal)}`}
            value={Math.min(raised, goal)}
            max={goal}
          />
        )}
        <Link
          href={url}
          label={isLive ? `Open your page: ${url}` : `Preview your page: ${url}`}
        />
        <Button
          key="copy"
          onPress={async press => {
            const { isCopied } = await $.ui.copy({ text: url, surface: press.surface })
            $.ui.toast(isCopied ? 'PayIt2 link copied' : `Copy this link: ${url}`)
          }}
        >
          Copy link
        </Button>
      </Box>
    )
  }).catch(($, e, next) => next(e))
}
