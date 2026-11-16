import { type AppLocale, translate } from "../lib/i18n";

export function LargeDocumentFallback({
	locale = "en",
}: {
	locale?: AppLocale;
}) {
	return (
		<div
			className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 px-6 text-center"
			role="status"
			data-testid="large-document-fallback"
		>
			<h2 className="text-sm font-medium">
				{translate(locale, "filePreview.largeDocumentTitle")}
			</h2>
			<p className="max-w-lg text-sm text-muted-foreground">
				{translate(locale, "filePreview.largeDocumentDescription")}
			</p>
		</div>
	);
}
