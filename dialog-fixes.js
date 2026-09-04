document.addEventListener('click', event => {
  const cancelButton = event.target.closest('dialog button[value="cancel"]');
  if (!cancelButton) return;
  event.preventDefault();
  cancelButton.closest('dialog')?.close();
}, true);
