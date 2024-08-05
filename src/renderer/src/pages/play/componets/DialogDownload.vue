<template>
  <div class="download-warp">
    <div class="source-warp">
      <t-select v-model="downloadSource" :placeholder="$t('pages.player.download.soureceSelect')" size="small"
                style="width: 200px; display: inline-block" @change="downloadSourceChange">
        <t-option v-for="(_, key) in formData.season" :key="key" :value="key">{{ key }}</t-option>
      </t-select>
      <t-button size="small" theme="default" @click="copyCurrentUrl">{{
          $t('pages.player.download.copyCurrentUrl')
        }}
      </t-button>
    </div>
    <div class="content-warp">
      <t-textarea v-model="downloadText" :autosize="{ minRows: 3, maxRows: 5 }"/>
    </div>
    <div class="tip-warp">
      <span>{{ $t('pages.player.download.recommendDownloaderTip') }}</span>
      <t-link theme="primary" underline href="https://github.com/HeiSir2014/M3U8-Downloader/releases/"
              target="_blank">
        {{ $t('pages.player.download.recommendDownloaderName') }}
      </t-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import {useClipboard} from '@vueuse/core';
import {ref, watch} from 'vue';
import {MessagePlugin} from 'tdesign-vue-next';

import {t} from '@/locales';
import {supportedFormats} from '@/utils/tool';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  data: {
    type: Object,
    default: () => {
      return {
        season: {},
        current: '',
        info: null
      };
    },
  },
});
const {isSupported, copy} = useClipboard();
const formVisible = ref(false);
const formData = ref(props.data);

const downloadSource = ref();
const downloadEpisodes = ref([]);
let downloadText = ref("");

const emit = defineEmits(['update:visible']);

watch(
  () => formVisible.value,
  (val) => {
    emit('update:visible', val);
  },
);
watch(
  () => props.visible,
  (val) => {
    formVisible.value = val;
  },
);
watch(
  () => props.data,
  (val) => {
    formData.value = val;
  },
);

// 检查复制的复制
const checkDownloadUrl = (url) => {
  const urlExtension = url.match(/\.([^.]+)$/)?.[1]; // 使用正则表达式提取文件扩展名
  const isValid = urlExtension && supportedFormats.includes(urlExtension); // 检查是否在允许的扩展名列表中

  if (!isValid) MessagePlugin.warning(t('pages.player.download.copyCheck'));
};

// 复制到剪贴板
const copyToClipboard = (content, successMessage, errorMessage) => {
  copy(content);
  if (isSupported) MessagePlugin.info(successMessage);
  else MessagePlugin.warning(errorMessage);
};

// 复制下载地址列表
const downloadSourceChange = () => {
  let title = "未定义";
  let info = formData.value.info;
  if (info["vod_name"]) {
    title = info["vod_name"];
  } else if (info["name"]) {
    title = info["name"];
  }

  title = title.replaceAll(" ", "");

  const list: any = [];
  let txt = "";
  for (const item of formData.value.season[downloadSource.value]) {
    let [index, url] = item.split('$');
    list.push({
      value: url,
      label: index,
      disabled: false,
    });
    index = index.replaceAll(" ", "");
    txt += `N_m3u8DL-RE.exe ${url} --save-dir ${title} --save-name ${title}-${index}.mp4\n`;
  }
  downloadEpisodes.value = list;
  downloadText.value = txt;
};

// 复制下载链接
const copyDownloadUrl = () => {
  if (downloadText.value) {
    const successMessage = t('pages.player.download.copySuccess');
    const errorMessage = t('pages.player.download.copyFail');

    copyToClipboard(downloadText.value, successMessage, errorMessage);
    formVisible.value = false;
  } else {
    MessagePlugin.warning(t('pages.player.download.copyEmpty'));
  }
};

// 复制当前播放地址
const copyCurrentUrl = () => {
  const successMessage = t('pages.player.download.copySuccess');
  const errorMessage = t('pages.player.download.copyError');
  copyToClipboard(formData.value.current, successMessage, errorMessage);
  checkDownloadUrl(formData.value.current);

  formVisible.value = false;
};

const init = () => {
  for (let valueKey in formData.value.season) {
    downloadSource.value = valueKey;
    if (downloadSource.value) {
      break;
    }
  }
  downloadSourceChange();
}

defineExpose({
  init
});
</script>

<style lang="less" scoped>
.download-warp {
  .source-warp {
    display: flex;
    justify-content: space-between;
    flex-wrap: nowrap;
    flex-direction: row;
    align-items: center;
    color: var(--td-gray-color-6);
    font-size: var(--td-font-size-link-small);
  }

  .content-warp {
    margin: var(--td-comp-margin-s) 0;

    :deep(.t-button + .t-button) {
      margin-left: 0 !important;
    }
  }

  .tip-warp {
    bottom: calc(var(--td-comp-paddingTB-xxl) + 8px);
    font-size: var(--td-font-size-link-small);
    position: absolute;
    left: calc(var(--td-comp-paddingLR-xxl) + var(--td-size-1));
  }
}

// :deep(.t-select-input) {
//   color: var(--td-font-white-1) !important;
//   background-color: var(--td-bg-color-component) !important;
// }

// :deep(.t-input__inner),
// :deep(.t-transfer) {
//   color: var(--td-font-white-1) !important;
// }

// :deep(.t-input__inner) {
//   &::placeholder {
//     color: var(--td-gray-color-5);
//   }
// }

// .t-select :deep(.t-fake-arrow) {
//   color: var(--td-font-white-3);
// }

// .t-popup__content :deep(*) {
//   background: var(--td-gray-color-11) !important;
// }

// .t-select-option:not(.t-is-disabled):not(.t-is-selected):hover :deep(*) {
//   background-color: var(--td-gray-color-12);
// }

// .t-select-option :deep(*) {
//   color: var(--td-font-white-1);
// }

// .t-select-option.t-select-option__hover:not(.t-is-disabled).t-select-option.t-select-option__hover:not(.t-is-selected)
//   :deep(*) {
//   background-color: var(--td-gray-color-12);
// }

:deep(.t-transfer) {
  color: var(--td-text-color-primary);
  background-color: var(--td-bg-content-input);
  border-radius: var(--td-radius-large);

  &__list-source,
  &__list-target {
    border: var(--td-size-1) solid transparent;
  }

  &__list-header + :not(.t-transfer__list--with-search) {
    border-top: 1px solid var(--td-border-level-1-color);
  }

  &__list-item:hover {
    background-color: rgba(132, 133, 141, 0.16);
  }

  &__list-item.t-is-checked {
    background: var(--td-brand-color);
  }

  .t-checkbox__input {
    border: 1px solid transparent;
    background-color: var(--td-bg-color-secondarycontainer);
  }

  .t-button--variant-outline {
    background-color: var(--td-bg-color-secondarycontainer);
    border-color: transparent;

    &.t-is-disabled {
      border-color: transparent;
    }
  }
}

:deep(.t-input) {
  background-color: var(--td-bg-content-input) !important;
  border: none;
}
</style>
