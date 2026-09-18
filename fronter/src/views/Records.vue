<template>
  <section>
    <h1>{{ t('records') }}</h1>
    <div class="card" style="overflow:auto">
      <table>
        <thead>
          <tr>
            <th>{{ t('title') }}</th>
            <th>{{ t('questionCount') }}</th>
            <th>{{ t('correct') }}</th>
            <th>{{ t('wrong') }}</th>
            <th>{{ t('score') }}</th>
            <th>{{ t('submittedAt') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.paper_title }}</td>
            <td>{{ row.total_questions }}</td>
            <td>{{ row.correct_count }}</td>
            <td>{{ row.wrong_count }}</td>
            <td>{{ row.total_score }}</td>
            <td>{{ row.submitted_at }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length && !loading" class="muted">{{ t('empty') }}</p>
    </div>

    <p v-if="error" class="alert error" style="margin-top: 12px">{{ error }}</p>

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
  usePagedTable('/learning/records', { extra: () => ({ lang: state.lang }) });
</script>
