interface NotionProfile { notion_token: string | null; notion_database_id: string | null }
interface NotionDefaults { NOTION_API_KEY?: string; NOTION_DATABASE_ID?: string }

/** null inherits server defaults; an empty token explicitly disconnects this user. */
export function resolveNotionSettings(profile: NotionProfile, defaults: NotionDefaults = {
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
}) {
  if (profile.notion_token === '') return { token: null, databaseId: '', disabled: true }
  return {
    token: profile.notion_token ?? defaults.NOTION_API_KEY ?? null,
    databaseId: profile.notion_database_id || defaults.NOTION_DATABASE_ID || '',
    disabled: false,
  }
}
