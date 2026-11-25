/** Presentation preferences only. User metadata must never grant permissions. */
export type IndicatorPreferences = { version: 1; messages: boolean; questions: boolean; notifications: boolean };
export const DEFAULT_INDICATOR_PREFERENCES: Readonly<IndicatorPreferences> = Object.freeze({ version: 1, messages: true, questions: true, notifications: true });
export type IndicatorPreferenceState = { configured: boolean; preferences: IndicatorPreferences };
export function parseIndicatorPreferences(value: unknown): IndicatorPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error("Invalid indicator preferences");
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== 4 || !["version", "messages", "questions", "notifications"].every(key => fields[key] && "value" in fields[key])) throw new Error("Invalid indicator preferences");
  if (fields.version.value !== 1 || !["messages", "questions", "notifications"].every(key => typeof fields[key].value === "boolean")) throw new Error("Invalid indicator preferences");
  return { version: 1, messages: fields.messages.value, questions: fields.questions.value, notifications: fields.notifications.value };
}
export function readIndicatorPreferences(metadata: unknown): IndicatorPreferenceState {
  if (metadata === undefined) return { configured: false, preferences: { ...DEFAULT_INDICATOR_PREFERENCES } };
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("Invalid metadata");
  const field = Object.getOwnPropertyDescriptor(metadata, "notification_indicators");
  if (!field) return { configured: false, preferences: { ...DEFAULT_INDICATOR_PREFERENCES } };
  if (!("value" in field)) throw new Error("Invalid metadata");
  return { configured: true, preferences: parseIndicatorPreferences(field.value) };
}
export function equalIndicatorPreferences(a: IndicatorPreferences, b: IndicatorPreferences) {
  return a.version === b.version && a.messages === b.messages && a.questions === b.questions && a.notifications === b.notifications;
}
export function projectIndicatorPreferences(metadata: unknown) {
  const state = readIndicatorPreferences(metadata), p = state.preferences;
  return { indicator_preferences_configured: state.configured, indicator_preferences_version: state.configured ? p.version : null,
    indicator_messages: state.configured ? p.messages : null, indicator_questions: state.configured ? p.questions : null, indicator_notifications: state.configured ? p.notifications : null };
}
