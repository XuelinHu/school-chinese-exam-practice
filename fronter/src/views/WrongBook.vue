<template>
  <section>
    <h1>{{ t('wrongBook') }}</h1>
    <div class="grid">
      <article v-for="row in rows" :key="row.id" class="card">
        <div class="row">
          <span class="pill">{{ row.category_name }}</span>
          <span class="pill">{{ t('wrong') }}: {{ row.wrong_count }}</span>
        </div>
        <h3>{{ row.title }}</h3>
        <p class="muted">{{ t('analysis') }}: {{ row.analysis }}</p>
      </article>
    </div>
    <p v-if="error" class="alert error" style="margin-top: 12px">{{ error }}</p>
    <p v-if="!rows.length && !loading" class="muted">{{ t('empty') }}</p>

    <Pagination
      style="margin-top: 12px"
      :page="page"
      :page-size="size"
      :total="total"
      :total-pages="totalPages"
      :loading="loading"
      @page="changePage"
      @size="changePageSize"
    />
  </section>
</template>

<script setup>
import { usePagedTable } from '../composables/usePagedTable.js';
import Pagination from '../components/Pagination.vue';
import { state, t } from '../i18n/index.js';

const { rows, total, totalPages, loading, error, page, size, changePage, changePageSize } =
  usePagedTable('/learning/wrong-questions', { extra: () => ({ lang: state.lang }) });
</script>
