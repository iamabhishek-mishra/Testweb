async function includeLayoutPart() {
  const includes = document.querySelectorAll('[data-include]');
  if (!includes.length) return;

  await Promise.all(Array.from(includes).map(async (el) => {
    const path = el.dataset.include;
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const html = await response.text();
      el.outerHTML = html;
    } catch (error) {
      console.error('Failed to load layout include:', path, error);
    }
  }));

  window.dispatchEvent(new Event('layoutReady'));
}

document.addEventListener('DOMContentLoaded', includeLayoutPart);
