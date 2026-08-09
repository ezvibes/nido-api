<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useAuth } from '../composables/useAuth';
import { generateNewsletter, type GenerateNewsletterResponse } from '../composables/useApi';

const { user } = useAuth();
const loading = ref(false);
const error = ref('');
const success = ref('');
const result = ref<GenerateNewsletterResponse | null>(null);

// Form Inputs
const form = reactive({
  startDate: '',
  endDate: '',
  dateRangeLabel: '',
  weekendRecap: '',
  featuredShow: '',
  featuredFestival: '',
  rawCalendarData: '',
  useDatabase: true,
  augmentCalendar: false,
});

onMounted(() => {
  // Pre-fill date values to next week's Tuesday -> Sunday
  const today = new Date();
  const currentDay = today.getDay();
  
  // Calculate next Tuesday
  const daysUntilTuesday = (2 - currentDay + 7) % 7 || 7;
  const nextTuesday = new Date(today);
  nextTuesday.setDate(today.getDate() + daysUntilTuesday);
  nextTuesday.setHours(9, 0, 0, 0);

  // Calculate next Sunday
  const nextSunday = new Date(nextTuesday);
  nextSunday.setDate(nextTuesday.getDate() + 5);
  nextSunday.setHours(23, 59, 59, 999);

  // Format to YYYY-MM-DD for date input fields
  form.startDate = nextTuesday.toISOString().split('T')[0] || '';
  form.endDate = nextSunday.toISOString().split('T')[0] || '';
});

async function token() {
  if (!user.value) throw new Error('Sign in is required.');
  return user.value.getIdToken();
}

async function handleGenerate() {
  loading.value = true;
  error.value = '';
  success.value = '';
  
  try {
    const authToken = await token();
    
    // Construct ISO range strings
    const startIso = new Date(form.startDate + 'T00:00:00.000Z').toISOString();
    const endIso = new Date(form.endDate + 'T23:59:59.999Z').toISOString();
    
    const payload = {
      startDate: startIso,
      endDate: endIso,
      dateRangeLabel: form.dateRangeLabel || undefined,
      weekendRecap: form.weekendRecap || undefined,
      featuredShow: form.featuredShow || undefined,
      featuredFestival: form.featuredFestival || undefined,
      rawCalendarData: (form.augmentCalendar && form.rawCalendarData) ? form.rawCalendarData : undefined,
      useDatabase: form.useDatabase,
    };
    
    const response = await generateNewsletter(authToken, payload);
    result.value = response;
    success.value = 'Newsletter template generated successfully!';
  } catch (err: any) {
    console.error(err);
    const responseErr = err.response?.data?.message;
    error.value = Array.isArray(responseErr) ? responseErr.join(' ') : (responseErr || err.message || 'Generation failed.');
  } finally {
    loading.value = false;
  }
}

// Clipboard Action
const copied = ref(false);
function handleCopy() {
  if (!result.value?.newsletterDraft) return;
  
  navigator.clipboard.writeText(result.value.newsletterDraft)
    .then(() => {
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 2000);
    })
    .catch((err) => {
      console.error('Could not copy text: ', err);
      error.value = 'Failed to copy to clipboard.';
    });
}

function handleDownload() {
  if (!result.value?.newsletterDraft) return;
  const element = document.createElement('a');
  const file = new Blob([result.value.newsletterDraft], { type: 'text/markdown' });
  element.href = URL.createObjectURL(file);
  element.download = `weekly-top-picks-${form.startDate}-to-${form.endDate}.md`;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
</script>

<template>
  <div class="newsletter-page">
    <div class="page-header">
      <h2 class="page-title">Weekly Newsletter Curation</h2>
      <p class="page-description">
        Project <strong>TPS2q</strong>: Dynamically pull verified NC shows, hydrate the curation prompt, and output copy-pasteable newsletter templates for Beehiiv.
      </p>
    </div>

    <div class="grid-layout">
      <!-- Input Panel -->
      <div class="panel-card input-panel">
        <h3 class="panel-title">Curation Parameters</h3>
        <form @submit.prevent="handleGenerate" class="curation-form">
          <div class="form-row">
            <div class="form-group">
              <label for="startDate" class="form-label">Start Date</label>
              <input
                id="startDate"
                v-model="form.startDate"
                type="date"
                required
                class="form-control"
              />
            </div>
            <div class="form-group">
              <label for="endDate" class="form-label">End Date</label>
              <input
                id="endDate"
                v-model="form.endDate"
                type="date"
                required
                class="form-control"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="dateRangeLabel" class="form-label">Date Range Title Label (Optional)</label>
            <input
              id="dateRangeLabel"
              v-model="form.dateRangeLabel"
              type="text"
              placeholder="e.g. Tuesday, Aug 11 - Sunday, Aug 16, 2026"
              class="form-control"
            />
          </div>

          <div class="form-group">
            <label for="weekendRecap" class="form-label">Weekend Recap Notes</label>
            <textarea
              id="weekendRecap"
              v-model="form.weekendRecap"
              rows="3"
              placeholder="What went down at shows this weekend? Connecting back to community, music, and mental health..."
              class="form-control"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="featuredShow" class="form-label">Featured Show Notes</label>
            <textarea
              id="featuredShow"
              v-model="form.featuredShow"
              rows="2"
              placeholder="Highlight details for this week's Featured Show (artist, venue, date, special info)..."
              class="form-control"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="featuredFestival" class="form-label">Featured Festival Notes</label>
            <textarea
              id="featuredFestival"
              v-model="form.featuredFestival"
              rows="2"
              placeholder="Highlight details for this week's Featured Festival..."
              class="form-control"
            ></textarea>
          </div>

          <!-- Configuration -->
          <div class="config-section">
            <h4 class="config-title">Data Ingestion Curation</h4>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="form.useDatabase" />
                <span>Fetch from verified Nido Database (NC, active, approved)</span>
              </label>
            </div>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="form.augmentCalendar" />
                <span>Augment/Input raw calendar data (ICS url or text)</span>
              </label>
            </div>
            
            <transition name="expand">
              <div v-if="form.augmentCalendar" class="form-group calendar-input-container">
                <label for="rawCalendarData" class="form-label">ICS URL, raw ICS string, or text dump</label>
                <textarea
                  id="rawCalendarData"
                  v-model="form.rawCalendarData"
                  rows="4"
                  placeholder="Paste public .ics link, BEGIN:VCALENDAR, JSON list or raw text description..."
                  class="form-control code-text"
                ></textarea>
              </div>
            </transition>
          </div>

          <div v-if="error" class="error-banner">{{ error }}</div>
          <div v-if="success" class="success-banner">{{ success }}</div>

          <button type="submit" :disabled="loading" class="btn btn-primary btn-block">
            <span v-if="loading" class="loader-spinner"></span>
            <span>{{ loading ? 'Generating newsletter...' : 'Generate Newsletter Draft' }}</span>
          </button>
        </form>
      </div>

      <!-- Preview Panel -->
      <div class="panel-card preview-panel">
        <div class="preview-header">
          <h3 class="panel-title">Draft Preview</h3>
          <div class="preview-actions" v-if="result">
            <button @click="handleCopy" class="btn btn-outline btn-sm">
              {{ copied ? 'Copied!' : 'Copy to Clipboard' }}
            </button>
            <button @click="handleDownload" class="btn btn-outline btn-sm">
              Download .md
            </button>
          </div>
        </div>

        <div v-if="loading" class="preview-placeholder loading-placeholder">
          <div class="music-loader">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
          </div>
          <p>Gemini Copywriter is curating your weekly picks...</p>
        </div>

        <div v-else-if="result" class="preview-container">
          <div class="tab-content">
            <textarea
              readonly
              class="newsletter-output-editor"
              :value="result.newsletterDraft"
            ></textarea>
          </div>
          
          <div class="meta-section">
            <h4 class="meta-title">Ingested Shows Evaluated ({{ result.concertsCount }})</h4>
            <ul class="meta-concerts-list">
              <li v-for="(concert, idx) in result.concerts" :key="idx" class="meta-concert-item">
                <div class="concert-header-row">
                  <span class="concert-title-lbl">{{ concert.title || 'Untitled' }}</span>
                  <span class="concert-badge" :class="{'badge-partner': concert.isPartnerArtist}">
                    {{ concert.isPartnerArtist ? 'Partner Artist' : 'General' }}
                  </span>
                </div>
                <div class="concert-meta-details">
                  <span>{{ concert.date }}</span> • <span>{{ concert.venue }}</span>
                </div>
                <div class="concert-source-badge">{{ concert.source }}</div>
              </li>
            </ul>
          </div>
        </div>

        <div v-else class="preview-placeholder empty-placeholder">
          <span class="empty-icon">📝</span>
          <p>Fill out the parameters and click generate to review the newsletter preview.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.newsletter-page {
  padding: 1.5rem 0;
  color: var(--text);
}

.page-header {
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  margin: 0 0 0.5rem 0;
  color: var(--text-dark);
}

.page-description {
  color: var(--text-muted);
  font-size: 1rem;
  margin: 0;
  line-height: 1.6;
}

.grid-layout {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 2rem;
  align-items: start;
}

@media (max-width: 1024px) {
  .grid-layout {
    grid-template-columns: 1fr;
  }
}

.panel-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 1.5rem;
}

.panel-title {
  margin: 0 0 1.5rem 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-dark);
}

.curation-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-muted);
}

.form-control {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.625rem 0.875rem;
  font: inherit;
  font-size: 0.95rem;
  background: var(--surface-soft);
  color: var(--text);
  box-sizing: border-box;
  transition: border-color 0.2s, background 0.2s;
  width: 100%;
}

.form-control:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--surface);
}

textarea.form-control {
  resize: vertical;
}

.code-text {
  font-family: monospace;
  font-size: 0.85rem;
}

.config-section {
  border-top: 1px solid var(--border);
  padding-top: 1.25rem;
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.config-title {
  margin: 0 0 0.25rem 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-dark);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.checkbox-group {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  cursor: pointer;
  color: var(--text);
}

.checkbox-label input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--primary);
}

.calendar-input-container {
  margin-top: 0.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0.75rem 1.25rem;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary);
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-outline {
  border-color: var(--border);
  background: transparent;
  color: var(--text-muted);
}

.btn-outline:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.85rem;
  border-radius: 6px;
}

.btn-block {
  width: 100%;
}

.error-banner {
  background: #fef2f2;
  border: 1px solid #fee2e2;
  color: #b91c1c;
  border-radius: 8px;
  padding: 0.75rem;
  font-size: 0.88rem;
}

.success-banner {
  background: #f0fdf4;
  border: 1px solid #dcfce7;
  color: #15803d;
  border-radius: 8px;
  padding: 0.75rem;
  font-size: 0.88rem;
}

/* Loader Styles */
.loader-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #ffffff;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Preview Panel */
.preview-panel {
  display: flex;
  flex-direction: column;
  min-height: 500px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
}

.preview-header .panel-title {
  margin: 0;
}

.preview-actions {
  display: flex;
  gap: 0.5rem;
}

.preview-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--text-muted);
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
}

.loading-placeholder p {
  font-size: 0.95rem;
  font-weight: 500;
}

/* Music loader animation */
.music-loader {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 24px;
}

.music-loader .bar {
  width: 4px;
  background: var(--primary);
  border-radius: 2px;
  animation: load-bounce 0.8s ease-in-out infinite alternate;
}

.music-loader .bar:nth-child(1) { height: 10%; animation-delay: 0.1s; }
.music-loader .bar:nth-child(2) { height: 20%; animation-delay: 0.3s; }
.music-loader .bar:nth-child(3) { height: 30%; animation-delay: 0.2s; }
.music-loader .bar:nth-child(4) { height: 15%; animation-delay: 0.4s; }

@keyframes load-bounce {
  0% { transform: scaleY(1); }
  100% { transform: scaleY(3); }
}

.preview-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1;
}

.newsletter-output-editor {
  width: 100%;
  height: 400px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  font-family: monospace;
  font-size: 0.88rem;
  line-height: 1.5;
  background: var(--surface-soft);
  color: var(--text-dark);
  box-sizing: border-box;
  resize: vertical;
}

.newsletter-output-editor:focus {
  outline: none;
  border-color: var(--primary);
}

.meta-section {
  border-top: 1px solid var(--border);
  padding-top: 1.5rem;
}

.meta-title {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-dark);
}

.meta-concerts-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.meta-concert-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem;
  background: var(--surface-soft);
  position: relative;
}

.concert-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.concert-title-lbl {
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--text-dark);
}

.concert-badge {
  font-size: 0.72rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: var(--border);
  color: var(--text-muted);
  font-weight: 600;
}

.concert-badge.badge-partner {
  background: rgba(53, 211, 153, 0.15);
  color: #059669;
}

.concert-meta-details {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.concert-source-badge {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-style: italic;
  margin-top: 0.35rem;
  text-align: right;
}

/* Transition classes */
.expand-enter-active, .expand-leave-active {
  transition: all 0.25s ease-out;
  max-height: 200px;
  overflow: hidden;
}
.expand-enter-from, .expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
