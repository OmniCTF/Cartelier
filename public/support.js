'use strict';

const reportForm = document.querySelector('#report-form');
const reportResult = document.querySelector('#report-result');
const inboxButton = document.querySelector('#create-inbox');
const inboxResult = document.querySelector('#inbox-result');

reportForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  reportResult.textContent = 'Contacting staff…';
  const path = new FormData(reportForm).get('path');
  const response = await fetch('/api/report', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path })
  });
  const data = await response.json();
  reportResult.textContent = data.message || data.error;
});

inboxButton.addEventListener('click', async () => {
  const response = await fetch('/api/inboxes', { method: 'POST' });
  const data = await response.json();
  inboxResult.innerHTML = `Inbox ready: <a href="${data.url}">${data.url}</a>`;
});
