/**
 * Configuration for forwarding user problem reports from Tab 4 ("Feedback & Problems")
 * directly to a public Google Form response endpoint without requiring user sign-in.
 */
export interface FeedbackGoogleFormConfig {
  /** Exact `https://docs.google.com/forms/d/e/.../formResponse` POST URL. */
  formResponseUrl: string;
  /** Form entry key (`entry.123456789`) for the user's problem description (and combined diagnostics if diagnosticsEntryId is empty). */
  messageEntryId: string;
  /** Optional second form entry key (`entry.987654321`) dedicated to auto-captured technical & anatomical context. */
  diagnosticsEntryId: string;
}

export const FEEDBACK_GOOGLE_FORM_CONFIG: FeedbackGoogleFormConfig = {
  formResponseUrl:
    'https://docs.google.com/forms/d/e/1FAIpQLSdpWPdLdVsrpu_YCBOrlLM3WHtTucoEfRAuOye1yW-cJICOpg/formResponse',
  messageEntryId: 'entry.1576934774',
  diagnosticsEntryId: '',
};

export function isFeedbackFormConfigured(): boolean {
  const { formResponseUrl, messageEntryId } = FEEDBACK_GOOGLE_FORM_CONFIG;
  return Boolean(formResponseUrl.trim() && messageEntryId.trim());
}
