# Classic quotation template

`classic.hwpx` was converted from the supplied `Classic_Quotation.docx`
using the installed Hancom HWP automation API. It contains the actual
Hancom-generated package, section, styles and table definitions.

The server fills cells in this template using an XML DOM and preserves
unmodified package parts. It sets the font family to Pretendard; systems
without that font use Hancom's font fallback.

Validation on Windows with Hancom installed:

    node scripts/verify-hwpx.mjs
    powershell -NoProfile -File scripts/verify-hancom.ps1

The second command opens the generated files in Hancom and saves them back
as HWPX. The security module name is local to this workstation; adjust it
to the installed automation module on a different machine.
