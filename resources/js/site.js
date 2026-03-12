import Alpine from 'alpinejs'
import morph from '@alpinejs/morph'

window.Alpine = Alpine
Alpine.plugin(morph)

// Auto contrast: picks light/dark text color based on background luminance
function hexToRgb(hex) {
    hex = hex.replace('#', '')
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)]
}

function resolveColor(value) {
    value = value.trim()
    // Resolve chained CSS variables: var(--something)
    const varMatch = value.match(/^var\(([^)]+)\)$/)
    if (varMatch) {
        const resolved = getComputedStyle(document.documentElement).getPropertyValue(varMatch[1]).trim()
        return resolveColor(resolved)
    }
    return value
}

window.applyContrastColors = function () {
    const rootStyles = getComputedStyle(document.documentElement)
    document.querySelectorAll('[data-contrast]').forEach((el) => {
        // Read the bg variable name directly from the style attribute (not computed)
        const styleAttr = el.getAttribute('style') || ''
        const bgMatch = styleAttr.match(/background-color:\s*([^;]+)/)
        if (!bgMatch) return

        const bgValue = resolveColor(bgMatch[1])
        let r, g, b

        if (bgValue.startsWith('#')) {
            ;[r, g, b] = hexToRgb(bgValue)
        } else if (bgValue.startsWith('rgb')) {
            ;[r, g, b] = bgValue.match(/\d+/g)?.map(Number) || [0, 0, 0]
        } else {
            return
        }

        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        const light = rootStyles.getPropertyValue('--contrast-light').trim() || el.style.getPropertyValue('--contrast-light').trim() || '#ffffff'
        const dark = rootStyles.getPropertyValue('--contrast-dark').trim() || el.style.getPropertyValue('--contrast-dark').trim() || '#000000'
        el.style.color = luminance > 0.5 ? dark : light
    })
}

document.addEventListener('DOMContentLoaded', window.applyContrastColors)

Alpine.start()