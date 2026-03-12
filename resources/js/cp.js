Statamic.booting(() => {
    let lastSectionIndex = null;
    let lastFieldHandle = null;
    let lastItemIndex = null;
    let ignoreNextFocusin = false;

    function resolveTopLevelSet(set) {
        let topLevelSet = set;
        let parent = set.parentElement;
        while (parent) {
            const ancestor = parent.closest('[data-replicator-set]');
            if (ancestor) {
                topLevelSet = ancestor;
                parent = ancestor.parentElement;
            } else {
                break;
            }
        }
        const container = topLevelSet.closest('.replicator-fieldtype-container');
        if (!container) return null;
        const directSets = [...container.querySelectorAll('[data-replicator-set]')].filter(
            (s) => s.closest('.replicator-fieldtype-container') === container
        );
        return { topLevelSet, container, directSets, index: directSets.indexOf(topLevelSet) };
    }

    function getTopLevelReplicator() {
        const editor = document.querySelector('.live-preview-editor');
        if (!editor) return null;
        return editor.querySelector('.replicator-fieldtype-container');
    }

    function getDirectSets(container) {
        return [...container.querySelectorAll('[data-replicator-set]')].filter(
            (s) => s.closest('.replicator-fieldtype-container') === container
        );
    }

    function scrollAndFocus(el) {
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = el.querySelector('input, textarea, [contenteditable="true"], .ProseMirror, select');
        if (focusable) {
            ignoreNextFocusin = true;
            focusable.focus();
        }
    }

    function parseFieldInfo(fieldWrapper, sectionIndex) {
        if (!fieldWrapper) return { fieldHandle: null, itemIndex: null };
        const parts = fieldWrapper.id.split('_');
        const indexPos = parts.indexOf(String(sectionIndex), 1);
        if (indexPos === -1 || indexPos + 1 >= parts.length) return { fieldHandle: null, itemIndex: null };
        const fieldHandle = parts[indexPos + 1];
        let itemIndex = null;
        if (indexPos + 2 < parts.length) {
            const maybeIndex = parseInt(parts[indexPos + 2]);
            if (!isNaN(maybeIndex)) itemIndex = maybeIndex;
        }
        return { fieldHandle, itemIndex };
    }

    // CP -> Preview: focusin
    document.addEventListener('focusin', (e) => {
        if (ignoreNextFocusin) { ignoreNextFocusin = false; return; }
        const iframe = document.getElementById('live-preview-iframe');
        if (!iframe) return;
        const set = e.target.closest('[data-replicator-set]');
        if (!set) return;
        const resolved = resolveTopLevelSet(set);
        if (!resolved || resolved.index === -1) return;
        const fieldWrapper = e.target.closest('[id^="field_"]');
        const { fieldHandle, itemIndex } = parseFieldInfo(fieldWrapper, resolved.index);
        if (resolved.index === lastSectionIndex && fieldHandle === lastFieldHandle && itemIndex === lastItemIndex) return;
        lastSectionIndex = resolved.index;
        lastFieldHandle = fieldHandle;
        lastItemIndex = itemIndex;
        iframe.contentWindow.postMessage({
            name: 'statamic.preview.scrollToSection',
            sectionIndex: resolved.index,
            fieldHandle,
            itemIndex,
        }, '*');
    });

    // CP -> Preview: click on set headers
    document.addEventListener('click', (e) => {
        const iframe = document.getElementById('live-preview-iframe');
        if (!iframe) return;
        const set = e.target.closest('[data-replicator-set]');
        if (!set) return;
        if (e.target.closest('input, textarea, [contenteditable="true"], .ProseMirror, select')) return;

        const parentSet = set.parentElement?.closest('[data-replicator-set]');

        if (parentSet) {
            const resolved = resolveTopLevelSet(set);
            if (!resolved || resolved.index === -1) return;
            const fieldWrapper = set.closest('[id^="field_"]');
            const { fieldHandle } = parseFieldInfo(fieldWrapper, resolved.index);
            const nestedContainer = set.closest('.replicator-fieldtype-container');
            let itemIndex = null;
            if (nestedContainer) {
                const idx = getDirectSets(nestedContainer).indexOf(set);
                if (idx !== -1) itemIndex = idx;
            }
            lastSectionIndex = resolved.index;
            lastFieldHandle = fieldHandle;
            lastItemIndex = itemIndex;
            iframe.contentWindow.postMessage({
                name: 'statamic.preview.scrollToSection',
                sectionIndex: resolved.index,
                fieldHandle,
                itemIndex,
            }, '*');
        } else {
            if (e.target.closest('[id^="field_"]')) return;
            const resolved = resolveTopLevelSet(set);
            if (!resolved || resolved.index === -1) return;
            lastSectionIndex = resolved.index;
            lastFieldHandle = null;
            lastItemIndex = null;
            iframe.contentWindow.postMessage({
                name: 'statamic.preview.scrollToSection',
                sectionIndex: resolved.index,
                fieldHandle: null,
                itemIndex: null,
            }, '*');
        }
    });

    // Preview -> CP: click in preview focuses corresponding CP field
    window.addEventListener('message', (event) => {
        if (event.data.name !== 'statamic.preview.focusField') return;
        const { sectionIndex, fieldHandle, itemIndex, focusField } = event.data;
        const container = getTopLevelReplicator();
        if (!container) return;
        const directSets = getDirectSets(container);
        const targetSet = directSets[sectionIndex];
        if (!targetSet) return;

        const isCollapsed = targetSet.dataset.collapsed === 'true';
        if (isCollapsed) {
            const toggleBtn = targetSet.querySelector('header button');
            if (toggleBtn) toggleBtn.click();
        }

        setTimeout(() => {
            let targetEl = null;

            if (fieldHandle && itemIndex !== null && itemIndex !== undefined) {
                // Find input by ID pattern (works for grid and replicator)
                const idSuffix = focusField
                    ? `_${sectionIndex}_${fieldHandle}_${itemIndex}_${focusField}`
                    : `_${sectionIndex}_${fieldHandle}_${itemIndex}`;
                const input = document.querySelector(`[id$="${idSuffix}"]`);
                if (input) {
                    targetEl = input.closest('[data-ui-input-group]') || input.closest('td') || input;
                    scrollAndFocus(targetEl);
                    lastSectionIndex = sectionIndex;
                    lastFieldHandle = fieldHandle;
                    lastItemIndex = itemIndex;
                    return;
                }

                // Fallback: nested replicator
                const nestedContainer = targetSet.querySelector('.replicator-fieldtype-container');
                if (nestedContainer) {
                    const nestedSet = getDirectSets(nestedContainer)[itemIndex];
                    if (nestedSet) {
                        const nestedCollapsed = nestedSet.dataset.collapsed === 'true';
                        if (nestedCollapsed) {
                            const btn = nestedSet.querySelector('header button');
                            if (btn) btn.click();
                        }
                        if (focusField) {
                            setTimeout(() => {
                                const nestedInput = nestedSet.querySelector(`[id$="_${focusField}"]`);
                                targetEl = nestedInput
                                    ? nestedInput.closest('[data-ui-input-group]') || nestedInput
                                    : nestedSet;
                                scrollAndFocus(targetEl);
                            }, nestedCollapsed ? 300 : 0);
                            return;
                        }
                        targetEl = nestedSet;
                    }
                }
            } else if (fieldHandle) {
                const input = targetSet.querySelector(`[id$="_${fieldHandle}"]`);
                if (input) {
                    targetEl = input.closest('[data-ui-input-group]') || input;
                } else {
                    const nestedContainer = targetSet.querySelector('.replicator-fieldtype-container');
                    if (nestedContainer) {
                        targetEl = nestedContainer.closest('[data-ui-input-group]') || nestedContainer;
                    }
                }
            }

            scrollAndFocus(targetEl || targetSet);
            lastSectionIndex = sectionIndex;
            lastFieldHandle = fieldHandle;
            lastItemIndex = itemIndex;
        }, isCollapsed ? 300 : 0);
    });
});
