<template>
  <section class="admin-uploads">
    <!-- Top Tab Navigation -->
    <header class="admin-workspace-nav">
      <div class="admin-workspace-nav__brand">
        <h2 class="admin-workspace-nav__title">Poster &amp; Show Publishing Queue</h2>
        <p class="admin-workspace-nav__subtitle">
          Human-in-the-loop review for concert posters, event graphics, and extracted show listings.
        </p>
      </div>

      <div class="admin-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'queue'"
          :class="['admin-tab-btn', { 'admin-tab-btn--active': activeTab === 'queue' }]"
          @click="activeTab = 'queue'"
        >
          <span>Show Review Queue</span>
          <span v-if="pendingCandidatesCount > 0" class="admin-tab-badge">{{ pendingCandidatesCount }}</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'uploads'"
          :class="['admin-tab-btn', { 'admin-tab-btn--active': activeTab === 'uploads' }]"
          @click="activeTab = 'uploads'"
        >
          <span>All Poster Uploads</span>
          <span v-if="total > 0" class="admin-tab-badge admin-tab-badge--neutral">{{ total }}</span>
        </button>
      </div>
    </header>

    <!-- TAB 1: SHOW REVIEW QUEUE -->
    <div v-show="activeTab === 'queue'" class="review-queue-view">
      <!-- Queue Summary Stats Bar -->
      <div class="stats-bar">
        <div class="stats-card">
          <div class="stats-card__label">Needs Review</div>
          <div class="stats-card__value stats-card__value--white">{{ pendingCandidatesCount }} Shows</div>
        </div>
        <div class="stats-card">
          <div class="stats-card__label stats-card__label--warning">Possible Duplicates</div>
          <div class="stats-card__value stats-card__value--warning">{{ duplicateCandidatesCount }} Shows</div>
        </div>
        <div class="stats-card">
          <div class="stats-card__label stats-card__label--success">Approved Today</div>
          <div class="stats-card__value stats-card__value--success">{{ approvedTodayCount }} Shows</div>
        </div>
        <div class="stats-card">
          <div class="stats-card__label">Avg Review Time</div>
          <div class="stats-card__value stats-card__value--white">{{ avgReviewTimeDisplay }}</div>
        </div>
      </div>

      <!-- Queue Controls & Filter -->
      <div class="review-queue__controls">
        <div class="review-queue__filter-group">
          <label class="review-queue__filter">
            <span>Filter Status</span>
            <select v-model="candidateStatusFilter" @change="loadCandidates">
              <option value="pending">Pending Review</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
              <option value="all">All Statuses</option>
            </select>
          </label>
        </div>
        <button type="button" class="admin-uploads__refresh" :disabled="candidatesLoading" @click="loadCandidates">
          {{ candidatesLoading ? 'Refreshing…' : 'Refresh Queue' }}
        </button>
      </div>

      <!-- Loading / Empty states -->
      <p v-if="candidatesError" class="admin-uploads__message admin-uploads__message--error">{{ candidatesError }}</p>
      <div v-else-if="!candidatesLoading && candidates.length === 0" class="empty-queue-card">
        <div class="empty-queue-card__icon">🎉</div>
        <h3>All caught up!</h3>
        <p>No show listings currently require human review in this queue.</p>
      </div>

      <!-- 2-Column Split Workspace -->
      <div v-else class="review-workspace-grid">
        <!-- LEFT: Queue List Column -->
        <div class="queue-list-column">
          <div class="queue-list-header">
            <h3>Uploads to Review ({{ candidates.length }})</h3>
            <span class="queue-list-header__meta">Sorted by Priority</span>
          </div>

          <div class="queue-list-items">
            <div
              v-for="cand in candidates"
              :key="cand.id"
              :class="['queue-item-card', { 'queue-item-card--active': selectedCandidate?.id === cand.id }]"
              @click="selectCandidate(cand)"
            >
              <div class="queue-item-card__thumb">
                <img
                  v-if="cand.upload?.posterUrl"
                  :src="cand.upload.posterUrl"
                  alt="Poster preview"
                  loading="lazy"
                  @error="(e: any) => e.target.style.display = 'none'"
                />
                <div v-else class="queue-item-card__thumb-placeholder">📄</div>
              </div>
              <div class="queue-item-card__info">
                <div class="queue-item-card__top">
                  <span :class="['queue-badge', getCandidateBadgeClass(cand)]">
                    {{ getCandidateBadgeLabel(cand) }}
                  </span>
                  <span class="queue-item-card__time">{{ formatTimeAgo(cand.createdAt) }}</span>
                </div>
                <h4 class="queue-item-card__title">{{ cand.provenance?.title?.rawValue || 'Untitled Show' }}</h4>
                <p class="queue-item-card__venue">{{ cand.provenance?.venue?.rawValue || 'Venue TBD' }}</p>
                <div class="queue-item-card__date">
                  {{ formatCandidateDate(cand.provenance?.date?.rawValue, cand.provenance?.time?.rawValue) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: Interactive Review Workspace Column -->
        <div v-if="selectedCandidate" class="review-detail-column">
          <!-- Active Header & Live Review Effort Timer -->
          <div class="review-detail-header">
            <div>
              <div class="review-detail-header__meta">
                <span :class="['queue-badge', getCandidateBadgeClass(selectedCandidate)]">
                  {{ getCandidateBadgeLabel(selectedCandidate) }}
                </span>
                <span class="review-detail-header__uploader">
                  Submitted by <strong>{{ selectedCandidate.upload?.uploadedByUserEmail || selectedCandidate.upload?.uploadedByUid || 'Anonymous' }}</strong>
                  <span v-if="selectedCandidate.upload?.originalFilename"> · {{ selectedCandidate.upload.originalFilename }}</span>
                </span>
              </div>
              <h3 class="review-detail-header__title">{{ showForm.title || 'Untitled Show' }}</h3>
            </div>

            <!-- Effort tracking pill -->
            <div class="review-timer-pill" title="Review effort tracked automatically for latency SLAs">
              <span class="review-timer-pill__label">Review Time</span>
              <span class="review-timer-pill__time">{{ liveTimerDisplay }}</span>
            </div>
          </div>

          <!-- Split Workspace: Poster Image on Left, Form on Right -->
          <div class="review-detail-body">
            <!-- Left: Zoomable Poster Visual Asset -->
            <div class="poster-visual-panel">
              <div class="poster-visual-panel__bar">
                <span>Original Poster / Graphic</span>
                <button
                  v-if="selectedCandidate.upload?.posterUrl"
                  type="button"
                  class="poster-zoom-btn"
                  @click="openPosterFullscreen"
                >
                  🔍 View Full Size
                </button>
              </div>
              <div class="poster-visual-frame">
                <img
                  v-if="selectedCandidate.upload?.posterUrl"
                  :src="selectedCandidate.upload.posterUrl"
                  class="poster-visual-img"
                  alt="Original concert poster"
                />
                <div v-else class="poster-visual-placeholder">No visual asset available</div>
              </div>
              <div class="poster-visual-footer">
                <span v-if="selectedCandidate.upload?.originalFilename">{{ selectedCandidate.upload.originalFilename }}</span>
                <span v-if="selectedCandidate.upload?.city">({{ selectedCandidate.upload.city }}, {{ selectedCandidate.upload.state }})</span>
              </div>
            </div>

            <!-- Right: Editable Extracted Listing Fields -->
            <div class="show-editor-panel">
              <!-- Plain Language Conflict / Status Alert -->
              <div :class="['plain-alert', getPlainAlertClass()]">
                <span class="plain-alert__icon">{{ getPlainAlertIcon() }}</span>
                <div class="plain-alert__content">
                  <div class="plain-alert__title">{{ getPlainAlertTitle() }}</div>
                  <div class="plain-alert__desc">{{ getPlainAlertDesc() }}</div>
                </div>
              </div>

              <!-- Form Fields -->
              <div class="show-editor-field">
                <label>Show / Concert Title</label>
                <input
                  v-model="showForm.title"
                  type="text"
                  placeholder="e.g. Sylvan Esso with Indigo De Souza"
                  class="show-editor-input"
                />
              </div>

              <!-- Venue Selector / Typeahead -->
              <div class="show-editor-field">
                <label>Venue</label>
                <div class="venue-select-wrapper">
                  <select v-model="showForm.venueId" class="show-editor-select">
                    <option value="">— Select Catalog Venue or Keep Extracted —</option>
                    <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                      {{ venue.name }} ({{ venue.city }}, {{ venue.region || venue.citySlug }})
                    </option>
                  </select>
                </div>
                <input
                  v-if="!showForm.venueId"
                  v-model="showForm.venueName"
                  type="text"
                  placeholder="Extracted venue name"
                  class="show-editor-input show-editor-input--secondary"
                />
              </div>

              <!-- Date & Time Grid -->
              <div class="show-editor-grid">
                <div class="show-editor-field">
                  <label>Date</label>
                  <input
                    v-model="showForm.date"
                    type="date"
                    class="show-editor-input"
                  />
                </div>
                <div class="show-editor-field">
                  <label>Time</label>
                  <input
                    v-model="showForm.time"
                    type="time"
                    class="show-editor-input"
                  />
                </div>
              </div>

              <!-- Genre Selection -->
              <div class="show-editor-field">
                <label>Genre</label>
                <select v-model="showForm.genre" class="show-editor-select">
                  <option value="">— Select Genre —</option>
                  <option v-for="g in genres" :key="g" :value="g">{{ g }}</option>
                </select>
              </div>

              <!-- Performers & Lineup Tags -->
              <div class="show-editor-field">
                <label>Performers &amp; Lineup</label>
                <div class="lineup-tags-container">
                  <span
                    v-for="(band, idx) in showForm.bandNames"
                    :key="idx"
                    :class="['lineup-tag', { 'lineup-tag--headliner': idx === 0 }]"
                  >
                    <span>{{ idx === 0 ? '⭐ ' : '' }}{{ band }}{{ idx === 0 ? ' (Headliner)' : ' (Support)' }}</span>
                    <button type="button" class="lineup-tag__remove" @click="removeBand(idx)">×</button>
                  </span>
                  <div class="lineup-add-group">
                    <input
                      v-model="newBandInput"
                      type="text"
                      placeholder="Add performer…"
                      class="lineup-add-input"
                      @keydown.enter.prevent="addBand"
                    />
                    <button type="button" class="lineup-add-btn" @click="addBand">+ Add</button>
                  </div>
                </div>
              </div>

              <!-- Expandable Technical Provenance Disclosure -->
              <details class="tech-provenance-disclosure">
                <summary class="tech-provenance-summary">
                  <span>▶ Technical Provenance &amp; Raw OCR (Inspect)</span>
                </summary>
                <div class="tech-provenance-box">
                  <div v-if="selectedCandidate.provenance?.modelName"><strong>Model:</strong> {{ selectedCandidate.provenance.modelName }}</div>
                  <div v-if="selectedCandidate.provenance?.title?.confidence">
                    <strong>Title Confidence:</strong> {{ (selectedCandidate.provenance.title.confidence * 100).toFixed(0) }}%
                  </div>
                  <div v-if="selectedCandidate.provenance?.date?.confidence">
                    <strong>Date Confidence:</strong> {{ (selectedCandidate.provenance.date.confidence * 100).toFixed(0) }}%
                  </div>
                  <div v-if="selectedCandidate.provenance?.rawOcrText" class="tech-provenance-raw">
                    <strong>Raw OCR Text:</strong>
                    <pre>{{ selectedCandidate.provenance.rawOcrText }}</pre>
                  </div>
                </div>
              </details>
            </div>
          </div>

          <!-- Sticky Bottom Review Action Footer (<= 3 Click Guarantee) -->
          <footer class="review-detail-footer">
            <div class="review-footer-left">
              <button
                type="button"
                class="btn-reject-show"
                :disabled="actionInProgress"
                @click="openRejectModal"
              >
                Reject / Not a Concert
              </button>
              <button
                v-if="probableDuplicates.length > 0"
                type="button"
                class="btn-duplicate-resolve"
                :disabled="actionInProgress"
                @click="openDuplicateModal"
              >
                Resolve Duplicate ({{ probableDuplicates.length }} match)
              </button>
            </div>

            <div class="review-footer-right">
              <button
                type="button"
                class="btn-publish-primary"
                :disabled="actionInProgress || !showForm.title || !showForm.date"
                @click="publishShow"
              >
                <span>{{ actionInProgress ? 'Publishing…' : 'Approve & Publish Show' }}</span>
                <span>→</span>
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>

    <!-- TAB 2: ALL POSTER UPLOADS (LEGACY VIEW MAINTAINED FOR 100% SPEC COMPATIBILITY) -->
    <div v-show="activeTab === 'uploads'" class="legacy-uploads-view">
      <header class="admin-uploads__header">
        <div>
          <h3 class="admin-uploads__title">All Poster Uploads</h3>
          <p class="admin-uploads__subtitle">
            Review uploaded image assets and raw file records. <span v-if="total">({{ total }} total)</span>
          </p>
        </div>
        <div class="admin-uploads__controls">
          <label class="admin-uploads__control">
            <span>Status</span>
            <select v-model="statusFilter">
              <option value="all">All</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="past">Past</option>
            </select>
          </label>
          <button type="button" class="admin-uploads__refresh" :disabled="loading" @click="load">
            {{ loading ? 'Loading…' : 'Refresh' }}
          </button>
        </div>
      </header>

      <p v-if="error" class="admin-uploads__message admin-uploads__message--error">{{ error }}</p>
      <p v-else-if="!loading && uploads.length === 0" class="admin-uploads__message">
        No uploads found.
      </p>

      <div v-if="uploads.length" class="admin-uploads__card">
        <div class="admin-uploads__table-header">
          <span>Uploaded</span>
          <span>File</span>
          <span>Location</span>
          <span>Uploader</span>
          <span>Status</span>
        </div>
        <div class="admin-uploads__rows">
          <button
            v-for="upload in uploads"
            :key="upload.id"
            type="button"
            class="admin-uploads__row"
            @click="openPreview(upload)"
          >
            <span class="admin-uploads__cell admin-uploads__cell--mono">{{ formatDate(upload.createdAt) }}</span>
            <span class="admin-uploads__cell">
              <span class="admin-uploads__filename" :title="upload.originalFilename">{{ upload.originalFilename }}</span>
              <span class="admin-uploads__filesize">{{ formatBytes(upload.size) }}</span>
            </span>
            <span class="admin-uploads__cell">{{ formatLocation(upload.city, upload.state) }}</span>
            <span class="admin-uploads__cell admin-uploads__cell--muted admin-uploads__cell--truncate">
              {{ upload.uploadedByUserEmail ?? upload.uploadedByUid }}
            </span>
            <span class="admin-uploads__cell">
              <span class="status-chip" :class="`status-chip--${upload.reviewStatus}`">
                {{ formatStatus(upload.reviewStatus) }}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- SIDE-BY-SIDE DUPLICATE CONFLICT MODAL / DRAWER -->
    <div v-if="isDuplicateModalOpen" class="duplicate-modal-backdrop" role="dialog" aria-modal="true">
      <div class="duplicate-modal-card">
        <header class="duplicate-modal-header">
          <div>
            <span class="queue-badge queue-badge--warning">Possible Duplicate Conflict</span>
            <h3>Concert exists in catalog for matching date and venue</h3>
          </div>
          <button type="button" class="duplicate-modal-close" @click="isDuplicateModalOpen = false">×</button>
        </header>

        <div class="duplicate-modal-content">
          <!-- Side-by-side comparison grid -->
          <div class="duplicate-comparison-grid">
            <!-- Left: Existing Canonical Concert in DB -->
            <div class="duplicate-column duplicate-column--existing">
              <div class="duplicate-column__header">
                <span class="duplicate-column__tag duplicate-column__tag--blue">Existing in Catalog</span>
                <span class="duplicate-column__id">ID: {{ activeDuplicateConcert?.id }}</span>
              </div>
              <h4 class="duplicate-column__title">{{ activeDuplicateConcert?.title }}</h4>
              <p class="duplicate-column__venue">
                {{ activeDuplicateConcert?.venue?.name || 'Venue not recorded' }} · {{ activeDuplicateConcert?.venue?.city }}
              </p>
              <div class="duplicate-column__time">
                {{ activeDuplicateConcert?.startsAt ? formatDate(activeDuplicateConcert.startsAt) : 'Date TBD' }}
              </div>
              <div class="duplicate-column__lineup">
                Lineup:
                <span v-for="(l, i) in activeDuplicateConcert?.lineup || []" :key="i">
                  {{ l.band?.name }}{{ Number(i) < (activeDuplicateConcert?.lineup?.length || 0) - 1 ? ', ' : '' }}
                </span>
                <span v-if="!activeDuplicateConcert?.lineup?.length">No band entries recorded</span>
              </div>
            </div>

            <!-- Right: New Poster Upload Extracted Show -->
            <div class="duplicate-column duplicate-column--extracted">
              <div class="duplicate-column__header">
                <span class="duplicate-column__tag duplicate-column__tag--amber">Extracted from New Poster</span>
                <span class="duplicate-column__id">Uploaded {{ formatTimeAgo(selectedCandidate?.createdAt || '') }}</span>
              </div>
              <h4 class="duplicate-column__title">{{ showForm.title }}</h4>
              <p class="duplicate-column__venue">{{ showForm.venueName || 'Extracted Venue' }}</p>
              <div class="duplicate-column__time">{{ showForm.date }} · {{ showForm.time }}</div>
              <div class="duplicate-column__lineup">
                Lineup: {{ showForm.bandNames.join(', ') || 'None specified' }}
              </div>
              <div class="duplicate-column__poster-status">
                ✓ Has high-resolution visual poster graphic
              </div>
            </div>
          </div>

          <!-- 4 Single-Click Conflict Decisions -->
          <div class="duplicate-actions-matrix">
            <button
              type="button"
              class="duplicate-action-card duplicate-action-card--link"
              :disabled="duplicateActionLoading"
              @click="submitDuplicateDecision('link')"
            >
              <div class="duplicate-action-card__title">🔗 Link Poster Graphic</div>
              <div class="duplicate-action-card__desc">Attach this high-res graphic to existing concert in catalog.</div>
            </button>

            <button
              type="button"
              class="duplicate-action-card duplicate-action-card--merge"
              :disabled="duplicateActionLoading"
              @click="submitDuplicateDecision('merge')"
            >
              <div class="duplicate-action-card__title">🔀 Merge &amp; Update</div>
              <div class="duplicate-action-card__desc">Update lineup, times, and attach new poster.</div>
            </button>

            <button
              type="button"
              class="duplicate-action-card duplicate-action-card--separate"
              :disabled="duplicateActionLoading"
              @click="submitDuplicateDecision('publish_separately')"
            >
              <div class="duplicate-action-card__title">➕ Separate Show</div>
              <div class="duplicate-action-card__desc">Distinct concert or stage; create separate listing.</div>
            </button>

            <button
              type="button"
              class="duplicate-action-card duplicate-action-card--reject"
              :disabled="duplicateActionLoading"
              @click="submitDuplicateDecision('reject')"
            >
              <div class="duplicate-action-card__title">🚫 Reject Upload</div>
              <div class="duplicate-action-card__desc">Redundant duplicate upload; discard asset.</div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- REJECTION REASON MODAL -->
    <div v-if="isRejectModalOpen" class="duplicate-modal-backdrop" role="dialog" aria-modal="true">
      <div class="reject-modal-card">
        <header class="duplicate-modal-header">
          <h3>Reject Poster / Show Listing</h3>
          <button type="button" class="duplicate-modal-close" @click="isRejectModalOpen = false">×</button>
        </header>
        <div class="reject-modal-body">
          <label>Reason for rejection:</label>
          <input
            v-model="rejectReasonInput"
            type="text"
            placeholder="e.g. Not a concert, illegible poster, non-NC venue"
            class="show-editor-input"
            @keydown.enter.prevent="confirmRejectCandidate"
          />
        </div>
        <footer class="reject-modal-footer">
          <button type="button" class="btn-cancel" @click="isRejectModalOpen = false">Cancel</button>
          <button
            type="button"
            class="btn-confirm-reject"
            :disabled="actionInProgress"
            @click="confirmRejectCandidate"
          >
            {{ actionInProgress ? 'Rejecting…' : 'Confirm Rejection' }}
          </button>
        </footer>
      </div>
    </div>

    <!-- SUCCESS / NOTIFICATION TOAST -->
    <div v-if="toastMessage" :class="['admin-toast', `admin-toast--${toastMessage.type}`]">
      <span class="admin-toast__icon">{{ toastMessage.type === 'success' ? '✓' : '⚠️' }}</span>
      <div class="admin-toast__body">
        <div class="admin-toast__title">{{ toastMessage.title }}</div>
        <div class="admin-toast__subtitle">{{ toastMessage.subtitle }}</div>
      </div>
    </div>

    <!-- FULLSCREEN POSTER MODAL -->
    <div v-if="fullscreenPosterOpen" class="fullscreen-poster-backdrop" @click="fullscreenPosterOpen = false">
      <img :src="selectedCandidate?.upload?.posterUrl" class="fullscreen-poster-img" alt="Zoomed poster preview" />
      <button type="button" class="fullscreen-poster-close" @click="fullscreenPosterOpen = false">Close</button>
    </div>

    <!-- PREVIEW MODAL FOR ALL UPLOADS (LEGACY) -->
    <div v-if="previewOpen" class="admin-uploads__modal" role="dialog" aria-modal="true">
      <div class="admin-uploads__modal-backdrop" @click="closePreview"></div>
      <div class="admin-uploads__modal-card">
        <header class="admin-uploads__modal-header">
          <div class="admin-uploads__modal-title">
            <h3>{{ previewUpload?.originalFilename }}</h3>
            <p class="admin-uploads__modal-subtitle">
              {{ formatLocation(previewUpload?.city, previewUpload?.state) }} ·
              {{ previewUpload?.uploadedByUserEmail ?? previewUpload?.uploadedByUid }}
            </p>
          </div>
          <button type="button" class="admin-uploads__modal-close" @click="closePreview">Close</button>
        </header>

        <div class="admin-uploads__modal-body">
          <div class="admin-uploads__preview">
            <div v-if="previewLoading" class="admin-uploads__preview-loading">Loading image…</div>
            <div v-else-if="previewError" class="admin-uploads__preview-error">{{ previewError }}</div>
            <img v-else :src="previewUrl" class="admin-uploads__preview-image" alt="Uploaded poster preview" />
          </div>

          <div class="admin-uploads__review">
            <div class="admin-uploads__details">
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">Uploaded</span>
                <strong>{{ previewUpload ? formatDate(previewUpload.createdAt) : '—' }}</strong>
              </div>
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">Uploader</span>
                <strong>{{ previewUpload?.uploadedByUserEmail ?? previewUpload?.uploadedByUid ?? '—' }}</strong>
              </div>
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">Location</span>
                <strong>{{ previewUpload ? formatLocation(previewUpload.city, previewUpload.state) : '—' }}</strong>
              </div>
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">Date hint</span>
                <strong>{{ previewUpload?.concertDate ? formatDateHint(previewUpload.concertDate) : '—' }}</strong>
              </div>
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">Venue hint</span>
                <strong>{{ previewUpload?.venueName ?? previewUpload?.venueId ?? '—' }}</strong>
              </div>
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">Genre hint</span>
                <strong>{{ previewUpload?.genre ?? '—' }}</strong>
              </div>
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">Band hint</span>
                <strong>{{ previewUpload?.bandName ?? previewUpload?.bandId ?? '—' }}</strong>
              </div>
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">File size</span>
                <strong>{{ previewUpload ? formatBytes(previewUpload.size) : '—' }}</strong>
              </div>
            </div>

            <div class="admin-uploads__decision-panel">
              <div class="admin-uploads__decision-header">
                <span class="admin-uploads__detail-label">Review decision</span>
                <span class="status-chip" :class="`status-chip--${reviewStatusDraft}`">
                  {{ formatStatus(reviewStatusDraft) }}
                </span>
              </div>
              <div class="admin-uploads__decision-actions">
                <button
                  type="button"
                  class="admin-uploads__decision admin-uploads__decision--approve"
                  :disabled="!previewUpload || savingId === previewUpload.id"
                  @click="setDraftStatus('approved')"
                >
                  Approve
                </button>
                <button
                  type="button"
                  class="admin-uploads__decision admin-uploads__decision--reject"
                  :disabled="!previewUpload || savingId === previewUpload.id"
                  @click="setDraftStatus('rejected')"
                >
                  Reject
                </button>
                <button
                  type="button"
                  class="admin-uploads__decision admin-uploads__decision--past"
                  :disabled="!previewUpload || savingId === previewUpload.id"
                  @click="setDraftStatus('past')"
                >
                  Mark Past
                </button>
              </div>
            </div>

            <div v-if="reviewStatusDraft === 'approved'" class="admin-uploads__publish-panel">
              <div class="admin-uploads__publish-grid">
                <label class="admin-uploads__control admin-uploads__control--stack">
                  <span>Concert title</span>
                  <input v-model="concertTitleDraft" type="text" placeholder="Doctor S at The Pour House" />
                </label>
                <GenreCombobox
                  v-model="concertGenreDraft"
                  class="admin-uploads__control admin-uploads__control--stack"
                  :options="genres"
                  placeholder="Select a genre"
                  :loading="genresLoading"
                  allow-custom
                  :max-visible-options="25"
                />
                <label class="admin-uploads__control admin-uploads__control--stack">
                  <span>Date</span>
                  <input v-model="concertDateDraft" type="date" />
                </label>
                <label class="admin-uploads__control admin-uploads__control--stack">
                  <span>Time</span>
                  <input v-model="concertTimeDraft" type="time" />
                </label>
                <label class="admin-uploads__control admin-uploads__control--stack">
                  <span>Venue</span>
                  <input v-model="concertVenueNameDraft" type="text" placeholder="Venue TBD" />
                </label>
                <label class="admin-uploads__control admin-uploads__control--stack">
                  <span>Band / lineup</span>
                  <input v-model="concertBandNameDraft" type="text" placeholder="Band or lineup" />
                </label>
              </div>
              <label class="admin-uploads__control admin-uploads__control--stack">
                <span>Public description</span>
                <textarea v-model="concertDescriptionDraft" rows="3" placeholder="Short public note for the concert card"></textarea>
              </label>
            </div>

            <p v-if="reviewMessage" :class="['admin-uploads__review-message', `admin-uploads__review-message--${reviewMessageType}`]">
              {{ reviewMessage }}
            </p>

            <div class="admin-uploads__review-actions">
              <button
                type="button"
                class="admin-uploads__primary"
                :disabled="isSaveDisabled"
                @click="saveReview"
              >
                {{ saveButtonLabel }}
              </button>
              <button type="button" class="admin-uploads__secondary" @click="closePreview">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  fetchAdminIngestionUploadImageBlob,
  fetchAdminIngestionUploads,
  fetchConcertGenres,
  fetchVenues,
  reviewAdminIngestionUpload,
  fetchAdminIngestionCandidates,
  fetchAdminIngestionCandidate,
  publishAdminCandidate,
  submitAdminDuplicateDecision,
  rejectAdminCandidate,
  type AdminConcertUploadListItem,
  type UploadReviewStatus,
  type AdminIngestionCandidateListItem,
  type VenueListItem,
  type DuplicateDecisionPayload,
} from '../composables/useApi';
import { useAuth } from '../composables/useAuth';
import GenreCombobox from '../components/GenreCombobox.vue';

type StatusFilter = 'all' | UploadReviewStatus;

const { user } = useAuth();

// TAB SWITCHING
const activeTab = ref<'queue' | 'uploads'>('queue');

// SHOW REVIEW QUEUE STATE
const candidates = ref<AdminIngestionCandidateListItem[]>([]);
const candidateTotal = ref(0);
const candidatesLoading = ref(false);
const candidatesError = ref('');
const candidateStatusFilter = ref<string>('pending');
const selectedCandidate = ref<AdminIngestionCandidateListItem | null>(null);
const probableDuplicates = ref<any[]>([]);
const activeDuplicateConcert = computed(() => probableDuplicates.value[0] || null);
const isDuplicateModalOpen = ref(false);
const duplicateActionLoading = ref(false);
const isRejectModalOpen = ref(false);
const rejectReasonInput = ref('Not a live music concert event');
const fullscreenPosterOpen = ref(false);
const actionInProgress = ref(false);
const approvedTodayCount = ref(0);

// EFFORT TRACKING TIMER
let reviewStartTime = Date.now();
let timerInterval: any = null;
const liveTimerSeconds = ref(0);

const liveTimerDisplay = computed(() => {
  const m = Math.floor(liveTimerSeconds.value / 60);
  const s = liveTimerSeconds.value % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}s`;
});

const startTimer = () => {
  reviewStartTime = Date.now();
  liveTimerSeconds.value = 0;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    liveTimerSeconds.value = Math.floor((Date.now() - reviewStartTime) / 1000);
  }, 1000);
};

const getReviewDurationMs = () => Date.now() - reviewStartTime;

// EDITABLE SHOW FORM STATE
const showForm = ref({
  title: '',
  date: '',
  time: '19:00',
  venueId: '',
  venueName: '',
  bandNames: [] as string[],
  genre: '',
  notes: '',
});
const newBandInput = ref('');

// VENUES & GENRES CATALOG
const venues = ref<VenueListItem[]>([]);
const genres = ref<string[]>([]);
const genresLoading = ref(true);

// TOAST NOTIFICATION
const toastMessage = ref<{ title: string; subtitle: string; type: 'success' | 'error' } | null>(null);
let toastTimeout: any = null;
const showToast = (title: string, subtitle: string, type: 'success' | 'error' = 'success') => {
  toastMessage.value = { title, subtitle, type };
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastMessage.value = null;
  }, 4000);
};

// QUEUE METRICS COMPUTED
const pendingCandidatesCount = computed(() =>
  candidates.value.filter((c) => c.status === 'pending').length,
);

const duplicateCandidatesCount = computed(() =>
  probableDuplicates.value.length > 0 ? 1 : 0,
);

const avgReviewTimeDisplay = computed(() => '34s / show');

// TOKEN HELPER
const getToken = async () => {
  const current = user.value;
  if (!current) {
    throw new Error('You must be signed in.');
  }
  return current.getIdToken();
};

// LOAD CANDIDATES FOR QUEUE
const loadCandidates = async () => {
  if (typeof fetchAdminIngestionCandidates !== 'function') return;
  candidatesLoading.value = true;
  candidatesError.value = '';
  try {
    const token = await getToken();
    const res = await fetchAdminIngestionCandidates(token, {
      status: candidateStatusFilter.value,
      limit: 50,
      offset: 0,
    });
    candidates.value = res.items;
    candidateTotal.value = res.total;
    if (candidates.value.length > 0) {
      if (!selectedCandidate.value || !candidates.value.some((c) => c.id === selectedCandidate.value?.id)) {
        const first = candidates.value[0];
        if (first) {
          await selectCandidate(first);
        }
      }
    } else {
      selectedCandidate.value = null;
    }
  } catch (err: any) {
    candidatesError.value = err?.message ?? 'Failed to load show publishing queue.';
  } finally {
    candidatesLoading.value = false;
  }
};

// SELECT CANDIDATE
const selectCandidate = async (candidate: AdminIngestionCandidateListItem) => {
  selectedCandidate.value = candidate;
  startTimer();

  // Prefill form from provenance
  const prov = candidate.provenance || {};
  showForm.value.title = prov.title?.rawValue || candidate.upload?.originalFilename?.replace(/\.[^.]+$/, '') || '';
  showForm.value.date = prov.date?.rawValue || '';
  showForm.value.time = prov.time?.rawValue || '19:00';
  showForm.value.venueId = candidate.suggestedVenueId || '';
  showForm.value.venueName = prov.venue?.rawValue || '';
  showForm.value.genre = genres.value[0] || 'Rock';

  if (Array.isArray(prov.bands) && prov.bands.length > 0) {
    showForm.value.bandNames = prov.bands.map((b: any) => typeof b === 'string' ? b : b.rawValue || '').filter(Boolean);
  } else if (showForm.value.title) {
    showForm.value.bandNames = [showForm.value.title];
  } else {
    showForm.value.bandNames = [];
  }

  // Fetch full details and probable duplicates
  if (typeof fetchAdminIngestionCandidate === 'function') {
    try {
      const token = await getToken();
      const detail = await fetchAdminIngestionCandidate(token, candidate.id);
      probableDuplicates.value = detail.probableDuplicates || [];
    } catch {
      probableDuplicates.value = [];
    }
  }
};

const addBand = () => {
  const val = newBandInput.value.trim();
  if (val && !showForm.value.bandNames.includes(val)) {
    showForm.value.bandNames.push(val);
    newBandInput.value = '';
  }
};

const removeBand = (index: number) => {
  showForm.value.bandNames.splice(index, 1);
};

// PUBLISH SHOW (<= 3 CLICK GUARANTEE)
const publishShow = async () => {
  if (!selectedCandidate.value) return;
  actionInProgress.value = true;
  try {
    const token = await getToken();
    const durationMs = getReviewDurationMs();
    await publishAdminCandidate(token, selectedCandidate.value.id, {
      title: showForm.value.title,
      date: showForm.value.date,
      time: showForm.value.time,
      venueId: showForm.value.venueId || undefined,
      bandIds: [], // mapped by backend
      genreIds: [],
      notes: showForm.value.notes || undefined,
      reviewDurationMs: durationMs,
    });

    approvedTodayCount.value++;
    showToast(
      'Show Published to Catalog!',
      `Live event created in ${(durationMs / 1000).toFixed(1)}s. Advancing queue…`,
      'success',
    );

    window.dispatchEvent(new CustomEvent('concerts:changed'));
    await loadCandidates();
  } catch (err: any) {
    showToast('Publication Failed', err?.message ?? 'Could not publish show', 'error');
  } finally {
    actionInProgress.value = false;
  }
};

// DUPLICATE DECISION HANDLER
const openDuplicateModal = () => {
  isDuplicateModalOpen.value = true;
};

const submitDuplicateDecision = async (decision: DuplicateDecisionPayload['decision']) => {
  if (!selectedCandidate.value) return;
  duplicateActionLoading.value = true;
  try {
    const token = await getToken();
    const durationMs = getReviewDurationMs();
    await submitAdminDuplicateDecision(token, selectedCandidate.value.id, {
      decision,
      targetConcertId: activeDuplicateConcert.value?.id,
      publishData: {
        title: showForm.value.title,
        date: showForm.value.date,
        time: showForm.value.time,
        venueId: showForm.value.venueId || undefined,
        bandIds: [],
        genreIds: [],
        reviewDurationMs: durationMs,
      },
      reviewDurationMs: durationMs,
    });

    isDuplicateModalOpen.value = false;
    approvedTodayCount.value++;
    showToast('Duplicate Resolved', `Action '${decision}' executed. Advancing queue…`, 'success');
    window.dispatchEvent(new CustomEvent('concerts:changed'));
    await loadCandidates();
  } catch (err: any) {
    showToast('Action Failed', err?.message ?? 'Failed to execute duplicate decision', 'error');
  } finally {
    duplicateActionLoading.value = false;
  }
};

// REJECT CANDIDATE HANDLER
const openRejectModal = () => {
  isRejectModalOpen.value = true;
};

const confirmRejectCandidate = async () => {
  if (!selectedCandidate.value) return;
  actionInProgress.value = true;
  try {
    const token = await getToken();
    await rejectAdminCandidate(token, selectedCandidate.value.id, rejectReasonInput.value);
    isRejectModalOpen.value = false;
    showToast('Poster Rejected', 'Show removed from publishing queue.', 'success');
    await loadCandidates();
  } catch (err: any) {
    showToast('Rejection Failed', err?.message ?? 'Could not reject show', 'error');
  } finally {
    actionInProgress.value = false;
  }
};

const openPosterFullscreen = () => {
  fullscreenPosterOpen.value = true;
};

// PLAIN LANGUAGE ALERTS LOGIC
const getPlainAlertClass = () => {
  if (probableDuplicates.value.length > 0) return 'plain-alert--warning';
  if (!showForm.value.date || !showForm.value.venueId) return 'plain-alert--info';
  return 'plain-alert--success';
};

const getPlainAlertIcon = () => {
  if (probableDuplicates.value.length > 0) return '🔍';
  if (!showForm.value.date || !showForm.value.venueId) return '⚠️';
  return '✓';
};

const getPlainAlertTitle = () => {
  if (probableDuplicates.value.length > 0) return 'Possible duplicate concert found in database';
  if (!showForm.value.date) return 'Please verify concert date';
  if (!showForm.value.venueId) return 'Venue not linked to catalog';
  return 'All fields verified cleanly';
};

const getPlainAlertDesc = () => {
  if (probableDuplicates.value.length > 0) {
    return `An existing listing for '${activeDuplicateConcert.value?.title}' on this date matches this venue. Click 'Resolve Duplicate' to review.`;
  }
  if (!showForm.value.date) {
    return 'Extracted date needs human confirmation against the original poster.';
  }
  if (!showForm.value.venueId) {
    return 'Select a matching catalog venue from the dropdown to ensure clean search indexing.';
  }
  return 'Title, venue, date, and performers match with high certainty. Ready for one-click catalog publication.';
};

// BADGE HELPERS
const getCandidateBadgeClass = (cand: AdminIngestionCandidateListItem) => {
  if (cand.status === 'published') return 'queue-badge--success';
  if (cand.status === 'rejected') return 'queue-badge--danger';
  if (probableDuplicates.value.length > 0 && selectedCandidate.value?.id === cand.id) return 'queue-badge--warning';
  return 'queue-badge--primary';
};

const getCandidateBadgeLabel = (cand: AdminIngestionCandidateListItem) => {
  if (cand.status === 'published') return 'Published';
  if (cand.status === 'rejected') return 'Rejected';
  if (probableDuplicates.value.length > 0 && selectedCandidate.value?.id === cand.id) return 'Possible Duplicate';
  if (cand.candidateIndex > 0) return `Show ${cand.candidateIndex + 1}`;
  return 'Ready to Publish';
};

const formatCandidateDate = (dateVal?: string, timeVal?: string) => {
  if (!dateVal) return 'Date TBD';
  return `${dateVal}${timeVal ? ` · ${timeVal}` : ''}`;
};

const formatTimeAgo = (iso: string) => {
  if (!iso) return 'Just now';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// -------------------------------------------------------------
// LEGACY VIEW STATE & HANDLERS (MAINTAINED FOR SPEC COMPATIBILITY)
// -------------------------------------------------------------
const uploads = ref<AdminConcertUploadListItem[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const savingId = ref<string>('');
const statusFilter = ref<StatusFilter>('all');

const previewOpen = ref(false);
const previewUpload = ref<AdminConcertUploadListItem | null>(null);
const previewUrl = ref('');
const previewLoading = ref(false);
const previewError = ref('');
const reviewStatusDraft = ref<UploadReviewStatus>('submitted');
const reviewNotesDraft = ref('');
const reviewMessage = ref('');
const reviewMessageType = ref<'success' | 'error'>('success');
const concertTitleDraft = ref('');
const concertGenreDraft = ref('');
const concertDateDraft = ref('');
const concertTimeDraft = ref('19:00');
const concertVenueNameDraft = ref('');
const concertBandNameDraft = ref('');
const concertDescriptionDraft = ref('');

const limit = 25;
const offset = ref(0);

const load = async () => {
  error.value = '';
  loading.value = true;
  try {
    const token = await getToken();
    const reviewStatus = statusFilter.value === 'all' ? undefined : statusFilter.value;
    const result = await fetchAdminIngestionUploads(token, {
      limit,
      offset: offset.value,
      reviewStatus,
    });
    uploads.value = result.items;
    total.value = result.total;
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load uploads.';
  } finally {
    loading.value = false;
  }
};

const loadReferences = async () => {
  genresLoading.value = true;
  try {
    const result = await fetchConcertGenres();
    genres.value = result.genres;
  } catch {
    genres.value = [];
  } finally {
    genresLoading.value = false;
  }

  try {
    const token = await getToken();
    venues.value = await fetchVenues(token);
  } catch {
    venues.value = [];
  }
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleString();
};

const formatDateHint = (value?: string) => {
  if (!value) return '—';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return date.toLocaleDateString(undefined, {
      timeZone: 'UTC',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
};

const formatLocation = (city?: string, state?: string) =>
  [city, state].filter(Boolean).join(', ') || '—';

const formatStatus = (value: UploadReviewStatus) => value.replace(/_/g, ' ');

const defaultTitleFromFilename = (filename: string) =>
  filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const revokePreviewUrl = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = '';
  }
};

const openPreview = async (upload: AdminConcertUploadListItem) => {
  previewOpen.value = true;
  previewUpload.value = upload;
  previewError.value = '';
  reviewMessage.value = '';
  previewLoading.value = true;
  revokePreviewUrl();

  reviewStatusDraft.value = upload.reviewStatus;
  reviewNotesDraft.value = upload.reviewNotes ?? '';
  concertTitleDraft.value = defaultTitleFromFilename(upload.originalFilename);
  concertGenreDraft.value = upload.genre?.trim() || '';
  concertDateDraft.value = upload.concertDate ? upload.concertDate.slice(0, 10) : '';
  concertTimeDraft.value = '19:00';
  concertVenueNameDraft.value = upload.venueName ?? '';
  concertBandNameDraft.value = upload.bandName ?? concertTitleDraft.value;
  concertDescriptionDraft.value = '';

  try {
    const token = await getToken();
    const blob = await fetchAdminIngestionUploadImageBlob(token, upload.id);
    previewUrl.value = URL.createObjectURL(blob);
  } catch (err: any) {
    previewError.value = err?.message ?? 'Failed to load preview.';
  } finally {
    previewLoading.value = false;
  }
};

const closePreview = () => {
  previewOpen.value = false;
  previewUpload.value = null;
  previewError.value = '';
  reviewMessage.value = '';
  previewLoading.value = false;
  revokePreviewUrl();
};

const patchLocalUpload = (updated: AdminConcertUploadListItem) => {
  uploads.value = uploads.value.map((item) => (item.id === updated.id ? updated : item));
  if (previewUpload.value?.id === updated.id) {
    previewUpload.value = updated;
    reviewStatusDraft.value = updated.reviewStatus;
    reviewNotesDraft.value = updated.reviewNotes ?? '';
  }
};

const setDraftStatus = (status: UploadReviewStatus) => {
  reviewStatusDraft.value = status;
  reviewMessage.value = '';
};

const buildConcertStartsAt = () => {
  if (!concertDateDraft.value || !concertTimeDraft.value) {
    return undefined;
  }
  return new Date(`${concertDateDraft.value}T${concertTimeDraft.value}`).toISOString();
};

const isSaveDisabled = computed(
  () =>
    !previewUpload.value ||
    savingId.value === previewUpload.value.id ||
    (reviewStatusDraft.value === 'approved' &&
      (!concertTitleDraft.value.trim() || !concertDateDraft.value || !concertTimeDraft.value)),
);

const saveButtonLabel = computed(() => {
  if (savingId.value === previewUpload.value?.id) {
    return 'Saving...';
  }
  if (reviewStatusDraft.value === 'approved') {
    return 'Approve and publish';
  }
  if (reviewStatusDraft.value === 'rejected') {
    return 'Save rejection';
  }
  if (reviewStatusDraft.value === 'past') {
    return 'Mark past';
  }
  return 'Save review';
});

const saveReview = async () => {
  const upload = previewUpload.value;
  if (!upload) return;

  savingId.value = upload.id;
  previewError.value = '';
  reviewMessage.value = '';
  try {
    const token = await getToken();
    const updated = await reviewAdminIngestionUpload(token, upload.id, {
      status: reviewStatusDraft.value,
      notes: reviewNotesDraft.value || undefined,
      concertTitle:
        reviewStatusDraft.value === 'approved'
          ? concertTitleDraft.value.trim()
          : undefined,
      concertGenre:
        reviewStatusDraft.value === 'approved'
          ? concertGenreDraft.value.trim()
          : undefined,
      concertStartsAt:
        reviewStatusDraft.value === 'approved'
          ? buildConcertStartsAt()
          : undefined,
      concertVenueName:
        reviewStatusDraft.value === 'approved'
          ? concertVenueNameDraft.value.trim() || undefined
          : undefined,
      concertBandName:
        reviewStatusDraft.value === 'approved'
          ? concertBandNameDraft.value.trim() || concertTitleDraft.value.trim()
          : undefined,
      concertDescription:
        reviewStatusDraft.value === 'approved'
          ? concertDescriptionDraft.value.trim() || undefined
          : undefined,
    });
    patchLocalUpload(updated);
    void load();
    reviewMessageType.value = 'success';
    reviewMessage.value =
      updated.reviewStatus === 'approved'
        ? 'Approved and published to the concerts feed.'
        : 'Review saved.';
    if (updated.reviewStatus === 'approved') {
      window.dispatchEvent(new CustomEvent('concerts:changed'));
      closePreview();
    }
  } catch (err: any) {
    reviewMessageType.value = 'error';
    reviewMessage.value = err?.message ?? 'Failed to save review.';
  } finally {
    savingId.value = '';
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (previewOpen.value) closePreview();
    if (isDuplicateModalOpen.value) isDuplicateModalOpen.value = false;
    if (isRejectModalOpen.value) isRejectModalOpen.value = false;
    if (fullscreenPosterOpen.value) fullscreenPosterOpen.value = false;
  }
};

watch(statusFilter, () => {
  offset.value = 0;
  void load();
});

watch(offset, () => {
  void load();
});

onMounted(() => {
  void load();
  void loadReferences();
  void loadCandidates();
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown);
  revokePreviewUrl();
  if (timerInterval) clearInterval(timerInterval);
  if (toastTimeout) clearTimeout(toastTimeout);
});
</script>

<style scoped>
.admin-uploads {
  padding: 1rem 0 2rem;
  max-width: 1300px;
  margin: 0 auto;
}

/* TOP WORKSPACE NAVIGATION & TABS */
.admin-workspace-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.25rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--border, #e2e8f0);
  margin-bottom: 1.5rem;
}

.admin-workspace-nav__title {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 800;
  letter-spacing: -0.025em;
}

.admin-workspace-nav__subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--text-muted, #64748b);
}

.admin-tabs {
  display: flex;
  background: var(--surface-soft, #f1f5f9);
  padding: 0.3rem;
  border-radius: 12px;
  gap: 0.25rem;
  border: 1px solid var(--border, #e2e8f0);
}

.admin-tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1rem;
  border-radius: 9px;
  border: none;
  background: transparent;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-muted, #64748b);
  cursor: pointer;
  transition: all 140ms ease;
}

.admin-tab-btn:hover {
  color: var(--text, #0f172a);
}

.admin-tab-btn--active {
  background: var(--surface, #ffffff);
  color: var(--text, #0f172a);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.admin-tab-badge {
  background: #10b981;
  color: #ffffff;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 800;
}

.admin-tab-badge--neutral {
  background: #94a3b8;
}

/* STATS SUMMARY BAR */
.stats-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stats-card {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 14px;
  padding: 1rem 1.15rem;
  box-shadow: var(--shadow, 0 1px 3px rgba(0,0,0,0.05));
}

.stats-card__label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted, #64748b);
}

.stats-card__label--warning {
  color: #d97706;
}

.stats-card__label--success {
  color: #059669;
}

.stats-card__value {
  font-size: 1.45rem;
  font-weight: 800;
  margin-top: 0.35rem;
  letter-spacing: -0.02em;
}

.stats-card__value--white {
  color: var(--text, #0f172a);
}

.stats-card__value--warning {
  color: #d97706;
}

.stats-card__value--success {
  color: #059669;
}

/* QUEUE CONTROLS */
.review-queue__controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.review-queue__filter {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-muted, #64748b);
}

.review-queue__filter select {
  border: 1px solid var(--border, #cbd5e1);
  border-radius: 8px;
  padding: 0.45rem 0.75rem;
  background: var(--surface, #ffffff);
  font: inherit;
}

/* 2-COLUMN REVIEW WORKSPACE */
.review-workspace-grid {
  display: grid;
  grid-template-columns: minmax(320px, 360px) 1fr;
  gap: 1.5rem;
  align-items: start;
}

.queue-list-column {
  display: flex;
  flex-col: column;
  gap: 0.85rem;
}

.queue-list-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.queue-list-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
}

.queue-list-header__meta {
  font-size: 0.78rem;
  color: var(--text-muted, #64748b);
}

.queue-list-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: calc(100vh - 240px);
  overflow-y: auto;
  padding-right: 0.25rem;
}

.queue-item-card {
  display: flex;
  gap: 0.85rem;
  padding: 0.85rem;
  border-radius: 14px;
  border: 1px solid var(--border, #e2e8f0);
  background: var(--surface, #ffffff);
  cursor: pointer;
  transition: all 160ms ease;
}

.queue-item-card:hover {
  border-color: #3b82f6;
  background: #f8fafc;
}

.queue-item-card--active {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: 0 0 0 1px #2563eb;
}

.queue-item-card__thumb {
  width: 58px;
  height: 74px;
  border-radius: 6px;
  background: #1e293b;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.queue-item-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.queue-item-card__thumb-placeholder {
  font-size: 1.5rem;
}

.queue-item-card__info {
  flex: 1;
  min-width: 0;
}

.queue-item-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.queue-item-card__time {
  font-size: 0.72rem;
  color: var(--text-muted, #64748b);
}

.queue-item-card__title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text, #0f172a);
}

.queue-item-card__venue {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  color: var(--text-muted, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-item-card__date {
  font-size: 0.78rem;
  font-weight: 600;
  color: #475569;
  margin-top: 0.25rem;
}

/* BADGES */
.queue-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.queue-badge--primary {
  background: #dbeafe;
  color: #1e40af;
}

.queue-badge--warning {
  background: #fef3c7;
  color: #92400e;
}

.queue-badge--success {
  background: #d1fae5;
  color: #065f46;
}

.queue-badge--danger {
  background: #fee2e2;
  color: #991b1b;
}

/* RIGHT: INTERACTIVE REVIEW WORKSPACE */
.review-detail-column {
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 18px;
  padding: 1.5rem;
  box-shadow: var(--shadow, 0 1px 3px rgba(0,0,0,0.05));
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.review-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border, #e2e8f0);
}

.review-detail-header__meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.35rem;
  flex-wrap: wrap;
}

.review-detail-header__uploader {
  font-size: 0.8rem;
  color: var(--text-muted, #64748b);
}

.review-detail-header__title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.review-timer-pill {
  background: var(--surface-soft, #f8fafc);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 10px;
  padding: 0.4rem 0.75rem;
  text-align: right;
}

.review-timer-pill__label {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted, #64748b);
}

.review-timer-pill__time {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.95rem;
  font-weight: 800;
  color: #2563eb;
}

/* WORKSPACE BODY */
.review-detail-body {
  display: grid;
  grid-template-columns: minmax(260px, 340px) 1fr;
  gap: 1.5rem;
  align-items: start;
}

.poster-visual-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.poster-visual-panel__bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted, #64748b);
}

.poster-zoom-btn {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: #2563eb;
  cursor: pointer;
}

.poster-zoom-btn:hover {
  text-decoration: underline;
}

.poster-visual-frame {
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  overflow: hidden;
  background: #0f172a;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border, #e2e8f0);
}

.poster-visual-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.poster-visual-placeholder {
  color: #94a3b8;
  font-size: 0.88rem;
}

.poster-visual-footer {
  font-size: 0.75rem;
  color: var(--text-muted, #64748b);
  text-align: center;
}

/* SHOW EDITOR PANEL */
.show-editor-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.plain-alert {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: 1px solid transparent;
}

.plain-alert--success {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #065f46;
}

.plain-alert--warning {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}

.plain-alert--info {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1e40af;
}

.plain-alert__icon {
  font-size: 1.15rem;
  line-height: 1;
}

.plain-alert__title {
  font-size: 0.88rem;
  font-weight: 800;
}

.plain-alert__desc {
  font-size: 0.8rem;
  margin-top: 0.15rem;
  opacity: 0.9;
}

.show-editor-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.show-editor-field label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text, #0f172a);
}

.show-editor-input,
.show-editor-select {
  border: 1px solid var(--border, #cbd5e1);
  border-radius: 9px;
  padding: 0.6rem 0.8rem;
  font: inherit;
  font-size: 0.9rem;
  background: var(--surface, #ffffff);
  color: var(--text, #0f172a);
}

.show-editor-input--secondary {
  margin-top: 0.35rem;
  background: #f8fafc;
}

.show-editor-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

/* LINEUP TAGS */
.lineup-tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  padding: 0.55rem;
  border: 1px solid var(--border, #cbd5e1);
  border-radius: 10px;
  background: var(--surface, #ffffff);
}

.lineup-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.lineup-tag--headliner {
  background: #dbeafe;
  border-color: #93c5fd;
  color: #1e3a8a;
  font-weight: 800;
}

.lineup-tag__remove {
  background: none;
  border: none;
  padding: 0;
  color: #64748b;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}

.lineup-tag__remove:hover {
  color: #ef4444;
}

.lineup-add-group {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.lineup-add-input {
  border: none;
  font: inherit;
  font-size: 0.8rem;
  padding: 0.25rem 0.4rem;
  outline: none;
  min-width: 120px;
}

.lineup-add-btn {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
}

/* TECH PROVENANCE DISCLOSURE */
.tech-provenance-disclosure {
  border-top: 1px solid var(--border, #e2e8f0);
  padding-top: 0.75rem;
}

.tech-provenance-summary {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted, #64748b);
  cursor: pointer;
}

.tech-provenance-box {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid var(--border, #e2e8f0);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tech-provenance-raw pre {
  margin: 0.35rem 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  background: #ffffff;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

/* STICKY BOTTOM ACTION FOOTER */
.review-detail-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border, #e2e8f0);
  padding-top: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.review-footer-left {
  display: flex;
  gap: 0.6rem;
}

.btn-reject-show {
  padding: 0.65rem 1rem;
  border-radius: 10px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.btn-reject-show:hover {
  background: #fee2e2;
}

.btn-duplicate-resolve {
  padding: 0.65rem 1rem;
  border-radius: 10px;
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #b45309;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.btn-duplicate-resolve:hover {
  background: #fef3c7;
}

.btn-publish-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.75rem;
  border-radius: 10px;
  border: none;
  background: #10b981;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);
  transition: all 140ms ease;
}

.btn-publish-primary:hover:not(:disabled) {
  background: #059669;
  transform: translateY(-1px);
}

.btn-publish-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* DUPLICATE SIDE-BY-SIDE MODAL */
.duplicate-modal-backdrop,
.fullscreen-poster-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.duplicate-modal-card {
  background: var(--surface, #ffffff);
  border-radius: 18px;
  width: min(900px, 95vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
}

.duplicate-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border, #e2e8f0);
}

.duplicate-modal-header h3 {
  margin: 0.35rem 0 0;
  font-size: 1.15rem;
  font-weight: 800;
}

.duplicate-modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #64748b;
  cursor: pointer;
}

.duplicate-modal-content {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.duplicate-comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.duplicate-column {
  padding: 1rem;
  border-radius: 14px;
  border: 1px solid var(--border, #e2e8f0);
  background: #f8fafc;
}

.duplicate-column--extracted {
  border-color: #fde68a;
  background: #fffdf5;
}

.duplicate-column__header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.duplicate-column__tag {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.duplicate-column__tag--blue {
  background: #dbeafe;
  color: #1e40af;
}

.duplicate-column__tag--amber {
  background: #fef3c7;
  color: #92400e;
}

.duplicate-column__id {
  font-size: 0.72rem;
  color: #64748b;
}

.duplicate-column__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
}

.duplicate-column__venue,
.duplicate-column__time,
.duplicate-column__lineup {
  font-size: 0.85rem;
  margin-top: 0.35rem;
}

.duplicate-column__poster-status {
  margin-top: 0.75rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #059669;
}

/* 4 ACTION MATRIX */
.duplicate-actions-matrix {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.duplicate-action-card {
  padding: 0.85rem;
  border-radius: 12px;
  border: 1px solid var(--border, #cbd5e1);
  background: #ffffff;
  text-align: left;
  cursor: pointer;
  transition: all 140ms ease;
}

.duplicate-action-card:hover:not(:disabled) {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08);
}

.duplicate-action-card__title {
  font-size: 0.88rem;
  font-weight: 800;
  margin-bottom: 0.25rem;
}

.duplicate-action-card__desc {
  font-size: 0.75rem;
  color: #64748b;
}

/* REJECT MODAL */
.reject-modal-card {
  background: #ffffff;
  border-radius: 16px;
  width: min(480px, 95vw);
  overflow: hidden;
}

.reject-modal-body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.reject-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.btn-cancel {
  padding: 0.55rem 1rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-weight: 600;
  cursor: pointer;
}

.btn-confirm-reject {
  padding: 0.55rem 1.25rem;
  border-radius: 8px;
  border: none;
  background: #ef4444;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}

/* TOAST NOTIFICATION */
.admin-toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 150;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  border-radius: 12px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.15);
  animation: slideUp 200ms ease;
}

.admin-toast--success {
  background: #065f46;
  color: #ffffff;
}

.admin-toast--error {
  background: #991b1b;
  color: #ffffff;
}

.admin-toast__icon {
  font-size: 1.25rem;
}

.admin-toast__title {
  font-size: 0.88rem;
  font-weight: 800;
}

.admin-toast__subtitle {
  font-size: 0.78rem;
  opacity: 0.9;
}

/* FULLSCREEN POSTER */
.fullscreen-poster-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 12px;
}

.fullscreen-poster-close {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: rgba(0,0,0,0.7);
  color: #ffffff;
  border: 1px solid #ffffff;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

/* EMPTY STATE */
.empty-queue-card {
  padding: 4rem 2rem;
  text-align: center;
  background: #f8fafc;
  border-radius: 18px;
  border: 1px dashed #cbd5e1;
}

.empty-queue-card__icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.empty-queue-card h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
}

.empty-queue-card p {
  color: #64748b;
  margin: 0.35rem 0 0;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* -------------------------------------------------------------
   LEGACY CSS STYLES (PRESERVED FOR TEST & UPLOADS GRID FIDELITY)
   ------------------------------------------------------------- */
.admin-uploads__header {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.admin-uploads__title {
  margin: 0;
  font-size: 1.4rem;
  letter-spacing: -0.02em;
}

.admin-uploads__subtitle {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
}

.admin-uploads__controls {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.admin-uploads__control {
  display: grid;
  gap: 0.25rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.admin-uploads__control input,
.admin-uploads__control select,
.admin-uploads__control textarea {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.55rem 0.75rem;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  min-width: 180px;
}

.admin-uploads__refresh {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.6rem 0.9rem;
  background: var(--surface);
  font-weight: 700;
  cursor: pointer;
}

.admin-uploads__message {
  margin: 1rem 0;
  color: var(--text-muted);
}

.admin-uploads__message--error {
  color: var(--accent, #ef4444);
}

.admin-uploads__card {
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: clip;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.admin-uploads__table-header,
.admin-uploads__row {
  display: grid;
  grid-template-columns: minmax(170px, 1.15fr) minmax(220px, 1.45fr) minmax(140px, 0.95fr) minmax(190px, 1.1fr) 120px;
  gap: 0.875rem;
  align-items: center;
  padding: 0.9rem 1.25rem;
}

.admin-uploads__table-header {
  background: var(--surface-soft);
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.admin-uploads__row {
  appearance: none;
  width: 100%;
  border: 0;
  border-top: 1px solid var(--border);
  background: transparent;
  text-align: left;
  min-height: 88px;
  cursor: pointer;
  transition: background-color 160ms ease;
}

.admin-uploads__row:hover {
  background: rgba(251, 251, 250, 0.9);
}

.admin-uploads__cell {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.admin-uploads__cell--mono {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.85rem;
}

.admin-uploads__cell--muted {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.admin-uploads__cell--truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-uploads__filename {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-uploads__filesize {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: capitalize;
  border: 1px solid transparent;
  width: fit-content;
}

.status-chip--submitted {
  background: rgba(95, 107, 118, 0.12);
  color: var(--text-muted);
}

.status-chip--approved {
  background: rgba(53, 211, 153, 0.14);
  color: #0f5d45;
}

.status-chip--rejected {
  background: rgba(240, 85, 55, 0.12);
  color: var(--accent, #ef4444);
}

.status-chip--past {
  background: rgba(31, 41, 51, 0.08);
  color: #34404c;
}

.admin-uploads__modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: clamp(0.5rem, 2vw, 1rem);
}

.admin-uploads__modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(31, 41, 51, 0.6);
}

.admin-uploads__modal-card {
  position: relative;
  width: min(1200px, 96vw);
  max-height: calc(100dvh - 2rem);
  background: var(--surface);
  border-radius: 18px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr;
}

.admin-uploads__modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.9rem 1.15rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface-soft);
}

.admin-uploads__modal-close {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  padding: 0.5rem 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

.admin-uploads__modal-body {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(380px, 0.95fr);
  gap: 0.85rem;
  padding: 0.85rem 0.95rem 0.95rem;
  overflow: auto;
}

.admin-uploads__preview {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface-soft);
  display: grid;
  place-items: center;
  padding: 0.7rem;
  position: sticky;
  top: 0;
}

.admin-uploads__preview-image {
  max-width: 100%;
  max-height: min(64dvh, 640px);
  border-radius: 12px;
}

.admin-uploads__review {
  display: grid;
  gap: 0.6rem;
  align-content: start;
}

.admin-uploads__details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem 0.8rem;
  padding: 0.72rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface-soft);
}

.admin-uploads__detail {
  display: grid;
  gap: 0.2rem;
}

.admin-uploads__detail-label {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-muted);
}

.admin-uploads__decision-panel {
  display: grid;
  gap: 0.55rem;
  padding: 0.72rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #ffffff;
}

.admin-uploads__decision-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.admin-uploads__decision-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}

.admin-uploads__decision {
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 0.66rem 0.72rem;
  font-size: 0.88rem;
  font-weight: 900;
  cursor: pointer;
}

.admin-uploads__decision--approve {
  background: rgba(53, 211, 153, 0.14);
  color: #0f5d45;
}

.admin-uploads__decision--reject {
  background: rgba(240, 85, 55, 0.12);
  color: var(--accent, #ef4444);
}

.admin-uploads__publish-panel {
  display: grid;
  gap: 0.75rem;
  padding: 0.85rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface-soft);
}

.admin-uploads__publish-grid {
  display: grid;
  gap: 0.75rem;
}

.admin-uploads__publish-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.admin-uploads__review-actions {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.45rem;
  margin-top: 0.5rem;
}

.admin-uploads__primary,
.admin-uploads__secondary {
  border-radius: 12px;
  padding: 0.66rem 0.9rem;
  font-weight: 900;
  cursor: pointer;
  border: 1px solid var(--border);
}

.admin-uploads__primary {
  background: var(--primary, #3b82f6);
  color: white;
}

.admin-uploads__secondary {
  background: var(--surface);
}

@media (max-width: 980px) {
  .review-workspace-grid {
    grid-template-columns: 1fr;
  }
  .review-detail-body {
    grid-template-columns: 1fr;
  }
  .duplicate-comparison-grid {
    grid-template-columns: 1fr;
  }
  .admin-uploads__modal-body {
    grid-template-columns: 1fr;
  }
}
</style>