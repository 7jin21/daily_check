import { NextRequest, NextResponse } from 'next/server'
import { createReadonlyServerClient } from '@/lib/supabase-server'

// 日記データのエクスポート（データ所有権はユーザーにある）。
// GET /api/export?format=json | csv — 全件をファイルとしてダウンロードさせる。

const EXPORT_COLUMNS = [
  'entry_date',
  'mood',
  'energy',
  'events',
  'challenges',
  'gratitude',
  'freeform',
  'ai_draft',
  'edited_draft',
  'tags',
  'summary',
  'dominant_emotion',
  'created_at',
] as const

type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], unknown>

function csvEscape(value: unknown): string {
  if (value == null) return ''
  const str = Array.isArray(value) ? value.join('|') : String(value)
  // ダブルクォート・カンマ・改行を含む場合はクォートで包む
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  const supabase = await createReadonlyServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const format = req.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'json'

  const { data: entries, error } = await supabase
    .from('diary_entries')
    .select(EXPORT_COLUMNS.join(', '))
    .eq('user_id', user.id)
    .order('entry_date', { ascending: true })
    .limit(10000)

  if (error) {
    return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 })
  }

  const rows = (entries ?? []) as unknown as ExportRow[]
  const dateStamp = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })

  if (format === 'csv') {
    const header = EXPORT_COLUMNS.join(',')
    const body = rows
      .map((row) => EXPORT_COLUMNS.map((col) => csvEscape(row[col])).join(','))
      .join('\n')
    // BOM 付き UTF-8（Excel で文字化けさせない）
    const csv = `﻿${header}\n${body}`
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inner-mirror-export-${dateStamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  return new NextResponse(JSON.stringify(rows, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="inner-mirror-export-${dateStamp}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
