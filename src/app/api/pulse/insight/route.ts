import { NextResponse } from 'next/server'
import { db } from '@/db'
import { pulseInsights, issueVotes, candidates } from '@/db/schema'
import { sql, desc, eq, and, gte } from 'drizzle-orm'
import { grokChatCompletion } from '@/lib/grok'
import { scrapeUrl } from '@/lib/firecrawl'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Serve cached insight if less than 6 hours old
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
    const cached = await db
      .select()
      .from(pulseInsights)
      .where(
        and(
          eq(pulseInsights.insightType, 'issue_analysis'),
          gte(pulseInsights.generatedAt!, sixHoursAgo),
        ),
      )
      .orderBy(desc(pulseInsights.generatedAt))
      .limit(1)

    if (cached.length > 0 && cached[0]) {
      const hit = cached[0]
      return NextResponse.json({
        insight: hit.content,
        sources: hit.sources ?? [],
        generatedAt: hit.generatedAt,
        cached: true,
      })
    }

    // Get current top 3 issues by vote count
    const topIssues = await db
      .select({
        issue: issueVotes.issue,
        count: sql<number>`count(*)::int`,
      })
      .from(issueVotes)
      .groupBy(issueVotes.issue)
      .orderBy(desc(sql`count(*)`))
      .limit(3)

    if (topIssues.length === 0) {
      return NextResponse.json({ insight: null, cached: false })
    }

    const topIssueKeys = topIssues.map((i) => i.issue)

    // Candidates with AI issue positions
    const allCandidates = await db
      .select({
        name: candidates.name,
        district: candidates.district,
        aiIssues: candidates.aiIssues,
      })
      .from(candidates)
      .limit(50)

    type AiIssue = { issue: string; position: string; confidence: number }
    const aligned = allCandidates
      .filter((c) => {
        if (!c.aiIssues) return false
        return (c.aiIssues as AiIssue[]).some(
          (i) => topIssueKeys.includes(i.issue) && i.confidence > 0.6,
        )
      })
      .slice(0, 10)

    // Verify top issue via Firecrawl (non-fatal)
    type NewsSource = { headline: string; url: string; source: string }
    let newsSource: NewsSource | null = null
    try {
      const firstIssue = topIssues[0]
      if (firstIssue) {
        const topIssue = firstIssue.issue.replace(/_/g, ' ')
        const newsUrl = `https://www.bailiwickexpress.com/?s=jersey+${encodeURIComponent(topIssue)}+2026`
        const newsResult = await scrapeUrl(newsUrl, { formats: ['markdown'] })
        const headlineMatch = newsResult.markdown.match(/^#{1,3}\s+(.{20,120})/m)
        const headline = headlineMatch?.[1]
        if (headline) {
          newsSource = { headline, url: newsUrl, source: 'Bailiwick Express' }
        }
      }
    } catch {
      // Non-fatal — proceed without news source
    }

    const candidateSummaries = aligned
      .map((c) => {
        const positions = (c.aiIssues as AiIssue[] ?? [])
          .filter((i) => topIssueKeys.includes(i.issue))
          .map((i) => `${i.issue.replace(/_/g, ' ')}: ${i.position}`)
          .join('; ')
        return `- ${c.name} (${c.district}): ${positions}`
      })
      .join('\n')

    const userPrompt = `
You are an election analyst for Jersey's 2026 general election.

Public poll data shows Jersey voters' top concerns:
${topIssues.map((i, idx) => `${idx + 1}. ${i.issue.replace(/_/g, ' ')} (${i.count} votes)`).join('\n')}

Candidates with positions on these issues:
${candidateSummaries || '(No AI-extracted positions available yet)'}

${newsSource ? `Recent news confirms: "${newsSource.headline}"` : ''}

Write a 2-3 sentence neutral insight: What does this public data reveal about Jersey voters' priorities, and which candidates appear most aligned with these concerns?

Be factual, neutral, and cite specific candidate positions. No editorialising.
Return plain text only, no markdown.
`.trim()

    const { text: insight } = await grokChatCompletion({
      systemPrompt: 'You are a neutral election analyst. Be factual and concise.',
      userPrompt,
      temperature: 0,
      maxTokens: 300,
    })

    const sources = newsSource ? [newsSource] : []

    // Cache the insight
    await db.insert(pulseInsights).values({
      insightType: 'issue_analysis',
      content: insight,
      sources,
    })

    return NextResponse.json({
      insight,
      sources,
      generatedAt: new Date(),
      cached: false,
    })
  } catch (e) {
    console.error('[pulse/insight]', e)
    return NextResponse.json({ insight: null, cached: false }, { status: 500 })
  }
}
