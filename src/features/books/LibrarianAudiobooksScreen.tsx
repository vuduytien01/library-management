import {
  FALLBACK_BOOK_COVER,
  resolveAudiobookCoverUrl,
} from "@/src/core/mediaAssets";
import { booksService } from "@/src/features/books/books.service";
import { useContent } from "@/src/hooks/library/useContent";
import { useAuthStore } from "@/src/store/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  applyImportedR2StateFromAudiobooks,
  applyR2DraftFlags,
  buildAudiobookPayload,
  formDataFromR2Metadata,
  hasAnyR2Metadata,
  getR2DraftKey,
  hasUsableR2Metadata,
  markR2FolderImported,
  markR2ItemImported,
  mergeR2MetadataIntoForm,
} from "@/src/features/books/audiobooksHelpers";
import {
  buildR2PublicUrl,
  extractR2KeyFromUrl,
  normalizeR2KeyForMatch,
} from "@/src/features/books/r2Helpers";
type R2ImportProgress = {
  processed: number;
  total: number;
  percent: number;
  stage: string;
};

type AudiobookFormData = {
  title: string;
  title_vi: string;
  title_en: string;
  author: string;
  author_vi: string;
  author_en: string;
  narrator: string;
  narrator_vi: string;
  narrator_en: string;
  duration: string;
  cover_url: string;
  source: string;
  source_id: string;
  source_url: string;
  description: string;
  description_vi: string;
  description_en: string;
  publisher: string;
  isbn: string;
  categories: string;
  published_at: string;
  language: string;
};

const emptyFormData = (): AudiobookFormData => ({
  title: "",
  title_vi: "",
  title_en: "",
  author: "",
  author_vi: "",
  author_en: "",
  narrator: "",
  narrator_vi: "",
  narrator_en: "",
  duration: "0",
  cover_url: "",
  source: "fonos",
  source_id: "",
  source_url: "",
  description: "",
  description_vi: "",
  description_en: "",
  publisher: "",
  isbn: "",
  categories: "",
  published_at: "",
  language: "vi",
});

const forceMergeR2FormData = (
  current: AudiobookFormData,
  enriched: AudiobookFormData,
): AudiobookFormData => ({
  ...current,
  ...Object.fromEntries(
    (Object.keys(enriched) as Array<keyof AudiobookFormData>)
      .filter((key) => !!enriched[key])
      .map((key) => [key, enriched[key]]),
  ),
});

export default function LibrarianAudiobooks() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { audiobooks } = useContent();
  const { data: audiobookList, isLoading } = audiobooks.list();

  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingAudiobook, setEditingAudiobook] = useState<any | null>(null);
  const profile = useAuthStore((state) => state.profile);
  const isSuperAdmin = profile?.is_super_admin;

  // R2 Ingestion State
  const [r2ModalVisible, setR2ModalVisible] = useState(false);
  const [r2Loading, setR2Loading] = useState(false);
  const [r2Prefix, setR2Prefix] = useState("");
  const [r2Items, setR2Items] = useState<{ files: any[]; folders: any[] }>({
    files: [],
    folders: [],
  });
  const [r2Error, setR2Error] = useState("");
  const [r2Enriching, setR2Enriching] = useState(false);
  const [r2MetadataStatus, setR2MetadataStatus] = useState("");
  const [r2ProcessingKey, setR2ProcessingKey] = useState<string | null>(null);
  const [r2UploadingKeys, setR2UploadingKeys] = useState<string[]>([]);
  const [r2BulkStatus, setR2BulkStatus] = useState<string>("");
  const [r2ImportProgress, setR2ImportProgress] = useState<
    Record<string, R2ImportProgress>
  >({});
  const [isSavingAudiobook, setIsSavingAudiobook] = useState(false);
  const { r2 } = useContent();

  const [formData, setFormData] = useState<AudiobookFormData>(emptyFormData());

  const resetForm = () => {
    setFormData(emptyFormData());
    setEditingAudiobook(null);
    setR2MetadataStatus("");
  };

  const hasR2BulkUpload = r2UploadingKeys.some((key) =>
    key.startsWith("bulk:"),
  );
  const visibleR2ImportableFiles = r2Items.files.filter(
    (file) => !file.isImported,
  );
  const hasVisibleR2ImportableItems =
    visibleR2ImportableFiles.length > 0 ||
    r2Items.folders.some((folder) => !folder.isImported);
  const isR2Uploading = (key: string) => r2UploadingKeys.includes(key);
  const addR2UploadingKey = (key: string) => {
    setR2UploadingKeys((keys) => (keys.includes(key) ? keys : [...keys, key]));
  };
  const removeR2UploadingKey = (key: string) => {
    setR2UploadingKeys((keys) => keys.filter((item) => item !== key));
  };
  const setR2Progress = (key: string, progress: Partial<R2ImportProgress>) => {
    setR2ImportProgress((current) => ({
      ...current,
      [key]: {
        processed: progress.processed ?? current[key]?.processed ?? 0,
        total: progress.total ?? current[key]?.total ?? 0,
        percent: Math.max(
          0,
          Math.min(
            100,
            Math.round(progress.percent ?? current[key]?.percent ?? 0),
          ),
        ),
        stage: progress.stage || current[key]?.stage || "saving",
      },
    }));
  };
  const clearR2Progress = (key: string) => {
    setR2ImportProgress((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const formatR2Progress = (progress?: R2ImportProgress) => {
    if (!progress) return "0%";
    const count =
      progress.total > 0 ? ` (${progress.processed}/${progress.total})` : "";
    return `${progress.percent}%${count}`;
  };

  const clearR2DraftState = async (sourceId?: string) => {
    if (!sourceId) return;
    await AsyncStorage.removeItem(getR2DraftKey(sourceId)).catch((error) => {
      console.warn("[audiobooks] Failed to clear R2 draft:", error);
    });
  };

  const parseR2Draft = (rawDraft: string | null) => {
    if (!rawDraft) return null;
    try {
      return JSON.parse(rawDraft);
    } catch (error) {
      console.warn("[audiobooks] Ignoring invalid R2 draft metadata:", error);
      return null;
    }
  };

  const recordMatchesR2SourceId = (record: any, sourceId: string) => {
    const expectedKey = normalizeR2KeyForMatch(sourceId);
    if (!expectedKey) return false;

    const candidateKeys = [
      record?.r2_key_normalized,
      record?.source_platform === "r2" ? record?.source_id : null,
      extractR2KeyFromUrl(record?.source_url),
      ...(Array.isArray(record?.tags)
        ? record.tags
            .filter(
              (tag: unknown) =>
                typeof tag === "string" && tag.startsWith("r2_path:"),
            )
            .map((tag: string) => tag.replace("r2_path:", ""))
        : []),
    ];

    return candidateKeys.some(
      (key) => normalizeR2KeyForMatch(key) === expectedKey,
    );
  };

  const getExistingR2Metadata = async (sourceId: string) => {
    const fromList = Array.isArray(audiobookList)
      ? audiobookList.find((record: any) =>
          recordMatchesR2SourceId(record, sourceId),
        )
      : null;
    if (fromList) return fromList;

    return booksService.getAudiobookBySourceId("r2", sourceId);
  };

  const applyR2MetadataToForm = (
    sourceId: string,
    nextFormData: AudiobookFormData,
    options: { force?: boolean } = {},
  ) => {
    setFormData((current) => {
      if (current.source_id !== sourceId) return current;

      const next = options.force
        ? forceMergeR2FormData(current, nextFormData)
        : mergeR2MetadataIntoForm(current, current, nextFormData);
      const changedCount = (
        Object.keys(next) as Array<keyof AudiobookFormData>
      ).filter((key) => next[key] !== current[key]).length;

      setR2MetadataStatus(
        changedCount > 0
          ? `${options.force ? "Refetched and applied" : "Applied"} metadata to ${changedCount} field(s).`
          : "Metadata fetched, but no new field changed.",
      );
      return next;
    });
  };

  const markCurrentR2Imported = (sourceId?: string) => {
    if (!sourceId) return;
    setR2Items((items) => markR2ItemImported(items, sourceId));
    queryClient.invalidateQueries({ queryKey: ["audiobooks"] });
  };

  const cacheR2Audiobook = (record: any) => {
    if (!record?.id) return;
    queryClient.setQueriesData<any[]>(
      { queryKey: ["audiobooks"] },
      (current) =>
        Array.isArray(current)
          ? [record, ...current.filter((item) => item.id !== record.id)]
          : current,
    );
    queryClient.invalidateQueries({ queryKey: ["audiobooks"] });
  };

  const cacheR2Audiobooks = (records: any[]) => {
    const validRecords = records.filter((record) => record?.id);
    if (validRecords.length === 0) return;
    queryClient.setQueriesData<any[]>(
      { queryKey: ["audiobooks"] },
      (current) => {
        if (!Array.isArray(current)) return current;
        return [
          ...validRecords,
          ...current.filter(
            (item) => !validRecords.some((record) => record.id === item.id),
          ),
        ];
      },
    );
    queryClient.invalidateQueries({ queryKey: ["audiobooks"] });
  };

  const publishR2DraftNow = async (data: AudiobookFormData) => {
    if (!data.source_id) return null;

    const existing = await booksService.getAudiobookBySourceId(
      "r2",
      data.source_id,
    );
    if (existing?.id) {
      setEditingAudiobook(existing);
      markCurrentR2Imported(data.source_id);
      return existing;
    }

    const created = await booksService.importR2Audiobook(
      data.source_id,
      buildAudiobookPayload(data),
    );
    setEditingAudiobook(created);
    cacheR2Audiobook(created);
    markCurrentR2Imported(data.source_id);
    return created;
  };

  const fetchR2MetadataFormData = async (
    sourceId: string,
  ): Promise<AudiobookFormData> => {
    const cachedDraft = await AsyncStorage.getItem(getR2DraftKey(sourceId));
    const parsedDraft = parseR2Draft(cachedDraft);
    const enrichedDraft = await booksService.resolveR2AudiobookMetadata(
      sourceId,
      parsedDraft,
    );

    await AsyncStorage.setItem(
      getR2DraftKey(sourceId),
      JSON.stringify(enrichedDraft),
    );

    return formDataFromR2Metadata(sourceId, enrichedDraft);
  };

  const saveAppliedR2Metadata = async (
    sourceId: string,
    nextFormData: AudiobookFormData,
  ) => {
    const merged = forceMergeR2FormData(formData, nextFormData);
    const updated = await booksService.importR2Audiobook(
      sourceId,
      buildAudiobookPayload(merged),
    );
    setEditingAudiobook(updated);
    cacheR2Audiobook(updated);
    markCurrentR2Imported(sourceId);
  };

  const handleBulkImportR2 = async ({
    prefix,
    paths,
    label,
  }: {
    prefix?: string;
    paths?: string[];
    label: string;
  }) => {
    if (hasR2BulkUpload) return;
    const bulkKey = `bulk:${prefix || paths?.join("|") || "root"}`;
    addR2UploadingKey(bulkKey);
    setR2Progress(bulkKey, {
      processed: 0,
      total: paths?.length || 0,
      percent: 1,
      stage: "listing",
    });
    setR2BulkStatus(`Importing ${label}... 1%`);

    try {
      const result = await booksService.bulkImportR2Audiobooks({
        prefix,
        paths,
        recursive: true,
        onProgress: (progress) => {
          setR2Progress(bulkKey, progress);
          setR2BulkStatus(
            `Importing ${label}... ${formatR2Progress(progress)}`,
          );
        },
      });
      cacheR2Audiobooks(
        Array.isArray(result?.audiobooks) ? result.audiobooks : [],
      );
      if (prefix !== undefined) {
        setR2Items((items) =>
          prefix
            ? markR2FolderImported(items, prefix)
            : {
                files: items.files.map((file) => ({
                  ...file,
                  isImported: true,
                  isDraft: false,
                })),
                folders: items.folders.map((folder) => ({
                  ...folder,
                  isImported: true,
                  isDraft: false,
                })),
              },
        );
      }
      if (paths?.length) {
        setR2Items((items) =>
          paths.reduce((next, path) => markR2ItemImported(next, path), items),
        );
      }
      setR2BulkStatus(
        `Imported ${result?.imported || 0}/${result?.total || 0} - 100%` +
          (result?.failed ? `, failed ${result.failed}` : ""),
      );
      queryClient.invalidateQueries({ queryKey: ["audiobooks"] });
      Alert.alert(
        t("common.success"),
        `Imported ${result?.imported || 0}/${result?.total || 0} audiobook(s).`,
      );
    } catch (err: any) {
      setR2BulkStatus("");
      Alert.alert(
        t("common.error"),
        err?.message || "Cannot bulk import R2 audiobooks.",
      );
    } finally {
      removeR2UploadingKey(bulkKey);
      setTimeout(() => clearR2Progress(bulkKey), 1500);
    }
  };

  const handleQuickImportR2File = async (item: any) => {
    if (!item?.key || item.isImported || hasR2BulkUpload) return;
    addR2UploadingKey(item.key);
    setR2Progress(item.key, {
      processed: 0,
      total: 1,
      percent: 1,
      stage: "saving",
    });
    setR2BulkStatus(`Importing ${item.key}... 1%`);

    try {
      const result = await booksService.quickImportR2AudioFile(
        item.key,
        (progress) => {
          setR2Progress(item.key, progress);
          setR2BulkStatus(
            `Importing ${item.key}... ${formatR2Progress(progress)}`,
          );
        },
      );
      const importedRecords = Array.isArray(result?.audiobooks)
        ? result.audiobooks.filter((record) => record?.id)
        : [];
      if (importedRecords.length === 0) {
        throw new Error(
          "Import finished but no audiobook record was returned from Supabase.",
        );
      }
      setR2Items((items) => markR2ItemImported(items, item.key));
      setR2BulkStatus(`Imported ${result?.imported || 0}/1 - 100%`);
      await queryClient.invalidateQueries({ queryKey: ["audiobooks"] });
      await queryClient.refetchQueries({
        queryKey: ["audiobooks"],
        type: "active",
      });
      cacheR2Audiobooks(importedRecords);
      setSearchQuery("");
      setR2ModalVisible(false);
      Alert.alert(t("common.success"), `Imported ${item.key}.`);
    } catch (err: any) {
      setR2BulkStatus("");
      Alert.alert(
        t("common.error"),
        err?.message || "Cannot import this R2 file.",
      );
    } finally {
      removeR2UploadingKey(item.key);
      setTimeout(() => clearR2Progress(item.key), 1500);
    }
  };

  const handleApplyFetchedR2Metadata = async () => {
    if (!formData.source_id) return;

    const sourceId = formData.source_id;
    setR2MetadataStatus("Applying metadata...");
    setR2Enriching(true);
    setR2ProcessingKey(sourceId);

    try {
      setR2MetadataStatus("Checking saved metadata...");
      const existingMetadata = await getExistingR2Metadata(sourceId);
      if (hasUsableR2Metadata(existingMetadata || {})) {
        applyR2MetadataToForm(
          sourceId,
          formDataFromR2Metadata(sourceId, existingMetadata),
        );
      }

      const rawDraft = await AsyncStorage.getItem(getR2DraftKey(sourceId));
      let draft = parseR2Draft(rawDraft);

      if (hasUsableR2Metadata(draft || {})) {
        applyR2MetadataToForm(
          sourceId,
          formDataFromR2Metadata(sourceId, draft),
        );
      }

      if (!hasAnyR2Metadata(draft || {})) {
        setR2MetadataStatus("Fetching quick metadata...");
        draft = await r2.getMetadata(sourceId);
        await AsyncStorage.setItem(
          getR2DraftKey(sourceId),
          JSON.stringify({
            ...draft,
            source_platform: "r2",
            source_id: sourceId,
            source_url: buildR2PublicUrl(sourceId),
            tags: [`r2_path:${sourceId}`],
            is_free: true,
          }),
        );
      }

      if (hasAnyR2Metadata(draft || {})) {
        const nextFormData = formDataFromR2Metadata(sourceId, draft);
        applyR2MetadataToForm(sourceId, nextFormData);
      }

      setR2MetadataStatus("Looking up accurate book metadata...");
      const accurateFormData = await fetchR2MetadataFormData(sourceId);
      applyR2MetadataToForm(sourceId, accurateFormData, { force: true });
      setR2MetadataStatus("Saving fetched metadata...");
      await saveAppliedR2Metadata(sourceId, accurateFormData);
      setR2MetadataStatus("Refetched metadata applied and saved.");
    } catch (err: any) {
      setR2MetadataStatus("Cannot apply fetched metadata.");
      Alert.alert(
        t("common.error"),
        err?.message || "Cannot apply fetched metadata for this audio.",
      );
    } finally {
      setR2Enriching(false);
      setR2ProcessingKey(null);
    }
  };

  const handleEdit = (audiobook: any) => {
    setEditingAudiobook(audiobook);
    setR2MetadataStatus("");
    setFormData({
      title: audiobook.title || "",
      title_vi: audiobook.title_vi || audiobook.title || "",
      title_en: audiobook.title_en || "",
      author: audiobook.author || "",
      author_vi: audiobook.author_vi || audiobook.author || "",
      author_en: audiobook.author_en || audiobook.author || "",
      narrator: audiobook.narrator || "",
      narrator_vi: audiobook.narrator_vi || audiobook.narrator || "",
      narrator_en: audiobook.narrator_en || audiobook.narrator || "",
      duration: String(audiobook.duration_seconds || audiobook.duration || ""),
      cover_url: audiobook.cover_url || "",
      source: audiobook.source_platform || audiobook.source || "fonos",
      source_id: audiobook.source_id || "",
      source_url: audiobook.source_url || "",
      description: audiobook.description || "",
      description_vi: audiobook.description_vi || audiobook.description || "",
      description_en: audiobook.description_en || "",
      publisher: audiobook.publisher || "",
      isbn: audiobook.isbn || "",
      categories: Array.isArray(audiobook.categories)
        ? audiobook.categories.join(", ")
        : "",
      published_at: audiobook.published_at || "",
      language: audiobook.language || "vi",
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (isSavingAudiobook) return;

    const payload = buildAudiobookPayload(formData);
    setIsSavingAudiobook(true);

    try {
      if (formData.source === "r2" && formData.source_id) {
        addR2UploadingKey(formData.source_id);
        const existing =
          editingAudiobook?.id &&
          recordMatchesR2SourceId(editingAudiobook, formData.source_id)
            ? editingAudiobook
            : await booksService.getAudiobookBySourceId(
                "r2",
                formData.source_id,
              );

        const saved = await booksService.importR2Audiobook(
          formData.source_id,
          payload,
        );

        if (!saved?.id) {
          throw new Error("Supabase did not return an audiobook record.");
        }

        setEditingAudiobook(saved);
        cacheR2Audiobook(saved);
        void clearR2DraftState(formData.source_id);
        markCurrentR2Imported(formData.source_id);
        Alert.alert(
          t("common.success"),
          existing?.id ? t("messages.book_updated") : t("messages.book_added"),
        );
        setModalVisible(false);
        resetForm();
        return;
      }

      if (editingAudiobook?.id) {
        await audiobooks.update.mutateAsync({
          id: editingAudiobook.id,
          ...payload,
        });
        Alert.alert(t("common.success"), t("messages.book_updated"));
      } else {
        await audiobooks.add.mutateAsync(payload);
        Alert.alert(t("common.success"), t("messages.book_added"));
      }

      void clearR2DraftState(formData.source_id);
      setModalVisible(false);
      resetForm();
    } catch (err: any) {
      Alert.alert(t("common.error"), err?.message || String(err));
    } finally {
      if (formData.source === "r2" && formData.source_id) {
        removeR2UploadingKey(formData.source_id);
      }
      setIsSavingAudiobook(false);
    }
  };

  const handleOpenR2 = async (prefix = "") => {
    setR2Loading(true);
    setR2Prefix(prefix);
    setR2Error("");
    setR2ModalVisible(true);
    try {
      const data = await r2.list(prefix);
      const listedItems = {
        files: Array.isArray(data?.files) ? data.files : [],
        folders: Array.isArray(data?.folders) ? data.folders : [],
      };
      const reconciledItems = applyImportedR2StateFromAudiobooks(
        listedItems,
        audiobookList,
      );
      setR2Items(await applyR2DraftFlags(reconciledItems));
    } catch (err: any) {
      const message = err?.message || "Cannot list R2 objects";
      setR2Error(message);
      setR2Items({ files: [], folders: [] });
      Alert.alert(t("common.error"), message);
    } finally {
      setR2Loading(false);
    }
  };

  const handleSelectR2File = async (item: any) => {
    const baseFormData = formDataFromR2Metadata(item.key, {});
    setR2MetadataStatus("");
    setFormData(baseFormData);
    setR2ModalVisible(false);
    setModalVisible(true);
    setR2Enriching(true);
    setR2ProcessingKey(item.key);
    setEditingAudiobook(null);

    setR2Items((items) => ({
      files: items.files.map((file) => ({
        ...file,
        isDraft: file.key === item.key ? true : file.isDraft,
      })),
      folders: items.folders.map((folder) => ({
        ...folder,
        isDraft:
          item.key.startsWith(folder.key) && !folder.isImported
            ? true
            : folder.isDraft,
      })),
    }));

    await AsyncStorage.setItem(
      getR2DraftKey(item.key),
      JSON.stringify({
        ...baseFormData,
        source_platform: "r2",
        tags: [`r2_path:${item.key}`],
        is_free: true,
      }),
    );

    try {
      const nextFormData = await fetchR2MetadataFormData(item.key);
      setFormData((current) =>
        mergeR2MetadataIntoForm(current, baseFormData, nextFormData),
      );
      setR2MetadataStatus("Metadata loaded. Review fields before saving.");
    } catch (err: any) {
      setR2MetadataStatus(
        "Metadata is not ready yet. Use Apply fetched metadata to retry.",
      );
      console.warn("[audiobooks] R2 metadata enrichment failed:", err);
    } finally {
      setR2Enriching(false);
      setR2ProcessingKey(null);
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert(
      t("librarian.delete_confirm"),
      t("librarian.delete_confirm_msg"),
      [
        { text: t("common.cancel") },
        {
          text: t("common.confirm"),
          style: "destructive",
          onPress: () => {
            audiobooks.delete.mutate(item.id, {
              onSuccess: () => {
                Alert.alert(t("common.success"), t("audiobook.delete_success"));
              },
              onError: (err: any) => {
                Alert.alert(t("common.error"), err.message);
              },
            });
          },
        },
      ],
    );
  };

  const filteredAudiobooks = audiobookList?.filter(
    (ab: any) =>
      ab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ab.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ab.narrator?.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const activeBulkProgress = Object.entries(r2ImportProgress).find(([key]) =>
    key.startsWith("bulk:"),
  )?.[1];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t("audiobook.management")}</Text>
          <Text style={styles.headerSubtitle}>
            {t("audiobook.subtitle_mgmt")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {isSuperAdmin && (
            <TouchableOpacity
              onPress={() => handleOpenR2()}
              style={styles.importR2Btn}
            >
              <Ionicons name="cloud-download" size={18} color="#FFFFFF" />
              <Text style={styles.importR2Text}>Import from R2</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              resetForm();
              setModalVisible(true);
            }}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#5A5F7A" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("audiobook.search_placeholder_mgmt")}
            placeholderTextColor="#5A5F7A"
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#5A5F7A" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollArea}
      >
        {isLoading ? (
          <View style={styles.loader}>
            <Text style={styles.loaderText}>{t("messages.loading")}</Text>
          </View>
        ) : (
          filteredAudiobooks?.map((ab: any) => {
            const coverUrl = resolveAudiobookCoverUrl(ab, FALLBACK_BOOK_COVER);

            return (
              <View key={ab.id} style={styles.card}>
                <View style={styles.cardContent}>
                  <Image
                    source={{ uri: coverUrl }}
                    style={styles.cover}
                    resizeMode="contain"
                  />
                  <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={2}>
                      {ab.title}
                    </Text>
                    <Text style={styles.author} numberOfLines={1}>
                      {ab.author || t("common.unknown")}
                    </Text>
                    <Text style={styles.narrator} numberOfLines={1}>
                      {t("audiobook.voice_prefix")}{" "}
                      {ab.narrator || t("common.unknown")}
                    </Text>
                    <View style={styles.sourceBadge}>
                      <Text style={styles.sourceText}>
                        {(
                          ab.source_platform ||
                          ab.source ||
                          "N/A"
                        ).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleEdit(ab)}
                    >
                      <Ionicons name="pencil" size={18} color="#4F8EF7" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deleteBtn]}
                      onPress={() => handleDelete(ab)}
                    >
                      <Ionicons name="trash" size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIndicator} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAudiobook
                  ? t("audiobook.edit_title")
                  : t("audiobook.add_title")}
              </Text>
              <TouchableOpacity
                accessibilityLabel="Close audiobook form"
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color="#8B8FA3" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
                <View style={styles.previewPanel}>
                  <Image
                    source={{
                      uri: formData.cover_url || FALLBACK_BOOK_COVER,
                    }}
                    style={styles.previewCover}
                    resizeMode="contain"
                  />
                  <View style={styles.previewText}>
                    <Text style={styles.previewTitle} numberOfLines={2}>
                      {formData.title_vi ||
                        formData.title ||
                        "Untitled audiobook"}
                    </Text>
                    <Text style={styles.previewAuthor} numberOfLines={1}>
                      {formData.author_vi ||
                        formData.author ||
                        t("common.unknown")}
                    </Text>
                    <Text style={styles.previewMeta} numberOfLines={2}>
                      {formData.source.toUpperCase()} ·{" "}
                      {formData.source_id || "no source id"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>TITLE VI</Text>
                <TextInput
                  value={formData.title_vi}
                  onChangeText={(val) =>
                    setFormData({
                      ...formData,
                      title_vi: val,
                      title: val || formData.title,
                    })
                  }
                  placeholder="Muôn Kiếp Nhân Sinh 1..."
                  placeholderTextColor="#3D4260"
                  style={styles.textInput}
                />

                <Text style={styles.fieldLabel}>TITLE EN</Text>
                <TextInput
                  value={formData.title_en}
                  onChangeText={(val) =>
                    setFormData({ ...formData, title_en: val })
                  }
                  placeholder="Many Times, Many Lives 1..."
                  placeholderTextColor="#3D4260"
                  style={styles.textInput}
                />

                <Text style={styles.fieldLabel}>
                  {t("common.author").toUpperCase()}
                </Text>
                <TextInput
                  value={formData.author}
                  onChangeText={(val) =>
                    setFormData({ ...formData, author: val })
                  }
                  placeholder={t("common.author") + "..."}
                  placeholderTextColor="#3D4260"
                  style={styles.textInput}
                />

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>AUTHOR VI</Text>
                    <TextInput
                      value={formData.author_vi}
                      onChangeText={(val) =>
                        setFormData({ ...formData, author_vi: val })
                      }
                      placeholder="Nguyên Phong..."
                      placeholderTextColor="#3D4260"
                      style={styles.textInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>AUTHOR EN</Text>
                    <TextInput
                      value={formData.author_en}
                      onChangeText={(val) =>
                        setFormData({ ...formData, author_en: val })
                      }
                      placeholder="Nguyen Phong..."
                      placeholderTextColor="#3D4260"
                      style={styles.textInput}
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>
                  {t("audiobook.narrator_label")}
                </Text>
                <TextInput
                  value={formData.narrator}
                  onChangeText={(val) =>
                    setFormData({ ...formData, narrator: val })
                  }
                  placeholder={t("audiobook.narrator_label") + "..."}
                  placeholderTextColor="#3D4260"
                  style={styles.textInput}
                />

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>NARRATOR VI</Text>
                    <TextInput
                      value={formData.narrator_vi}
                      onChangeText={(val) =>
                        setFormData({ ...formData, narrator_vi: val })
                      }
                      placeholder="Giọng đọc..."
                      placeholderTextColor="#3D4260"
                      style={styles.textInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>NARRATOR EN</Text>
                    <TextInput
                      value={formData.narrator_en}
                      onChangeText={(val) =>
                        setFormData({ ...formData, narrator_en: val })
                      }
                      placeholder="Narrator..."
                      placeholderTextColor="#3D4260"
                      style={styles.textInput}
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>DURATION SECONDS</Text>
                <TextInput
                  value={formData.duration}
                  onChangeText={(val) =>
                    setFormData({ ...formData, duration: val })
                  }
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#3D4260"
                  style={styles.textInput}
                />

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>
                      {t("audiobook.source_label")}
                    </Text>
                    <TextInput
                      value={formData.source}
                      onChangeText={(val) =>
                        setFormData({ ...formData, source: val })
                      }
                      placeholder="fonos, voizfm..."
                      placeholderTextColor="#3D4260"
                      style={styles.textInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>R2 PATH / SOURCE ID</Text>
                    <TextInput
                      value={formData.source_id}
                      onChangeText={(val) =>
                        setFormData({
                          ...formData,
                          source_id: val,
                          source_url:
                            formData.source === "r2"
                              ? buildR2PublicUrl(val)
                              : formData.source_url,
                        })
                      }
                      placeholder="folder/audio.mp3"
                      placeholderTextColor="#3D4260"
                      style={styles.textInput}
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>SOURCE URL</Text>
                <TextInput
                  value={formData.source_url}
                  onChangeText={(val) =>
                    setFormData({ ...formData, source_url: val })
                  }
                  placeholder="https://pub-...r2.dev/folder/audio.mp3"
                  placeholderTextColor="#3D4260"
                  style={styles.textInput}
                />

                <Text style={styles.fieldLabel}>COVER URL</Text>
                <TextInput
                  value={formData.cover_url}
                  onChangeText={(val) =>
                    setFormData({ ...formData, cover_url: val })
                  }
                  placeholder="https://..."
                  placeholderTextColor="#3D4260"
                  style={styles.textInput}
                />

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>PUBLISHER</Text>
                    <TextInput
                      value={formData.publisher}
                      onChangeText={(val) =>
                        setFormData({ ...formData, publisher: val })
                      }
                      placeholder="NXB..."
                      placeholderTextColor="#3D4260"
                      style={styles.textInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>ISBN</Text>
                    <TextInput
                      value={formData.isbn}
                      onChangeText={(val) =>
                        setFormData({ ...formData, isbn: val })
                      }
                      placeholder="978..."
                      placeholderTextColor="#3D4260"
                      style={styles.textInput}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>CATEGORIES</Text>
                    <TextInput
                      value={formData.categories}
                      onChangeText={(val) =>
                        setFormData({ ...formData, categories: val })
                      }
                      placeholder="Tâm linh, Thiền"
                      placeholderTextColor="#3D4260"
                      style={styles.textInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>PUBLISHED AT</Text>
                    <TextInput
                      value={formData.published_at}
                      onChangeText={(val) =>
                        setFormData({ ...formData, published_at: val })
                      }
                      placeholder="2026-05-24"
                      placeholderTextColor="#3D4260"
                      style={styles.textInput}
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>
                  {t("common.description").toUpperCase()}
                </Text>
                <TextInput
                  value={formData.description}
                  onChangeText={(val) =>
                    setFormData({ ...formData, description: val })
                  }
                  multiline
                  placeholder={t("common.no_description")}
                  placeholderTextColor="#3D4260"
                  style={[
                    styles.textInput,
                    { height: 80, textAlignVertical: "top" },
                  ]}
                />

                <Text style={styles.fieldLabel}>DESCRIPTION VI</Text>
                <TextInput
                  value={formData.description_vi}
                  onChangeText={(val) =>
                    setFormData({ ...formData, description_vi: val })
                  }
                  multiline
                  placeholder="Mô tả tiếng Việt..."
                  placeholderTextColor="#3D4260"
                  style={[
                    styles.textInput,
                    { height: 80, textAlignVertical: "top" },
                  ]}
                />

                <Text style={styles.fieldLabel}>DESCRIPTION EN</Text>
                <TextInput
                  value={formData.description_en}
                  onChangeText={(val) =>
                    setFormData({ ...formData, description_en: val })
                  }
                  multiline
                  placeholder="English description..."
                  placeholderTextColor="#3D4260"
                  style={[
                    styles.textInput,
                    { height: 80, textAlignVertical: "top" },
                  ]}
                />

                {formData.source === "r2" && !!formData.source_id && (
                  <TouchableOpacity
                    disabled={
                      r2Enriching ||
                      audiobooks.add.isPending ||
                      audiobooks.update.isPending
                    }
                    onPress={handleApplyFetchedR2Metadata}
                    style={[
                      styles.metadataApplyBtn,
                      r2Enriching && styles.metadataApplyBtnDisabled,
                    ]}
                  >
                    <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                    <Text style={styles.metadataApplyText}>
                      {r2Enriching
                        ? "Metadata loading..."
                        : "Apply fetched metadata"}
                    </Text>
                  </TouchableOpacity>
                )}
                {formData.source === "r2" &&
                  !!formData.source_id &&
                  !!r2MetadataStatus && (
                    <Text style={styles.metadataApplyStatus}>
                      {r2MetadataStatus}
                    </Text>
                  )}

                <TouchableOpacity
                  disabled={
                    isSavingAudiobook ||
                    audiobooks.add.isPending ||
                    audiobooks.update.isPending
                  }
                  onPress={handleSave}
                  style={[
                    styles.submitBtn,
                    isSavingAudiobook && styles.submitBtnDisabled,
                  ]}
                >
                  <Text style={styles.submitBtnText}>
                    {isSavingAudiobook ||
                    audiobooks.add.isPending ||
                    audiobooks.update.isPending
                      ? t("common.loading")
                      : t("common.save")}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* R2 Explorer Modal */}
      <Modal visible={r2ModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: "80%" }]}>
            <View style={styles.modalIndicator} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>R2 Storage Explorer</Text>
                <Text style={styles.pathText}>/{r2Prefix || "root"}</Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Close R2 Explorer"
                onPress={() => setR2ModalVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color="#8B8FA3" />
              </TouchableOpacity>
            </View>

            <View style={styles.explorerActions}>
              <View style={styles.explorerActionRow}>
                {r2Prefix !== "" && (
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => {
                      const parts = r2Prefix.split("/").filter(Boolean);
                      parts.pop();
                      handleOpenR2(
                        parts.length > 0 ? parts.join("/") + "/" : "",
                      );
                    }}
                  >
                    <Ionicons name="arrow-back" size={20} color="#4F8EF7" />
                    <Text style={styles.backBtnText}>Back</Text>
                  </TouchableOpacity>
                )}
                {visibleR2ImportableFiles.length > 0 && (
                  <TouchableOpacity
                    disabled={hasR2BulkUpload}
                    style={[
                      styles.bulkImportBtn,
                      hasR2BulkUpload && styles.uploadR2FileBtnDisabled,
                    ]}
                    onPress={() => {
                      const visiblePaths = visibleR2ImportableFiles.map(
                        (file) => file.key,
                      );
                      void handleBulkImportR2({
                        paths: visiblePaths,
                        label: `${visiblePaths.length} visible file(s)`,
                      });
                    }}
                  >
                    <Ionicons name="cloud-upload" size={15} color="#FFFFFF" />
                    <Text style={styles.bulkImportText}>
                      Import visible files
                    </Text>
                  </TouchableOpacity>
                )}
                {hasVisibleR2ImportableItems && (
                  <TouchableOpacity
                    disabled={hasR2BulkUpload}
                    style={[
                      styles.bulkImportBtn,
                      hasR2BulkUpload && styles.uploadR2FileBtnDisabled,
                    ]}
                    onPress={() =>
                      handleBulkImportR2({
                        prefix: r2Prefix,
                        label: r2Prefix || "all R2",
                      })
                    }
                  >
                    <Ionicons name="folder-open" size={15} color="#FFFFFF" />
                    <Text style={styles.bulkImportText}>
                      {r2Prefix ? "Import folder recursively" : "Import all R2"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {!!r2BulkStatus && (
                <View style={styles.progressBlock}>
                  <Text style={styles.bulkStatusText}>{r2BulkStatus}</Text>
                  {activeBulkProgress ? (
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${activeBulkProgress.percent}%` },
                        ]}
                      />
                    </View>
                  ) : null}
                </View>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {r2Loading ? (
                <Text style={styles.loadingText}>Listing objects...</Text>
              ) : r2Error ? (
                <View style={styles.r2ErrorBox}>
                  <Ionicons name="warning" size={22} color="#FF9F43" />
                  <Text style={styles.r2ErrorText}>{r2Error}</Text>
                  <TouchableOpacity
                    style={styles.r2RetryBtn}
                    onPress={() => handleOpenR2(r2Prefix)}
                  >
                    <Text style={styles.r2RetryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.itemsList}>
                  {r2Items.folders.map((f) => (
                    <View
                      key={f.key}
                      style={[
                        styles.explorerItem,
                        f.isImported && { opacity: 0.65 },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.fileInfoBtn}
                        onPress={() => handleOpenR2(f.key)}
                      >
                        <Ionicons
                          name="folder"
                          size={24}
                          color={f.isImported ? "#5A5F7A" : "#FFD93D"}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.itemKey,
                              f.isImported && { color: "#5A5F7A" },
                            ]}
                            numberOfLines={1}
                          >
                            {f.key.split("/").filter(Boolean).pop()}/
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {f.isImported ? (
                        <Text style={styles.importedLabel}>Imported</Text>
                      ) : (
                        <View style={styles.r2ActionGroup}>
                          {f.isDraft ? (
                            <Text style={styles.draftLabel}>Draft</Text>
                          ) : null}
                          <TouchableOpacity
                            disabled={hasR2BulkUpload}
                            onPress={() =>
                              handleBulkImportR2({
                                prefix: f.key,
                                label: f.key,
                              })
                            }
                            style={[
                              styles.uploadR2FileBtn,
                              hasR2BulkUpload && styles.uploadR2FileBtnDisabled,
                            ]}
                          >
                            <Ionicons
                              name="cloud-upload"
                              size={14}
                              color="#FFFFFF"
                            />
                            <Text style={styles.uploadR2FileText}>
                              Import folder
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))}
                  {r2Items.files.map((f) => (
                    <View
                      key={f.key}
                      style={[
                        styles.explorerItem,
                        f.isImported && { opacity: 0.5 },
                      ]}
                    >
                      <TouchableOpacity
                        disabled={
                          f.isImported ||
                          isR2Uploading(f.key) ||
                          hasR2BulkUpload
                        }
                        onPress={() => handleSelectR2File(f)}
                        style={styles.fileInfoBtn}
                      >
                        <Ionicons
                          name="musical-notes"
                          size={24}
                          color={f.isImported ? "#5A5F7A" : "#4F8EF7"}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.itemKey,
                              f.isImported && { color: "#5A5F7A" },
                            ]}
                            numberOfLines={1}
                          >
                            {f.key.split("/").pop()}
                          </Text>
                          <Text style={styles.itemSize}>
                            {(f.size / (1024 * 1024)).toFixed(1)} MB
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {f.isImported ? (
                        <Text style={styles.importedLabel}>Imported</Text>
                      ) : (
                        <View style={styles.r2ActionGroup}>
                          {isR2Uploading(f.key) ? (
                            <View style={styles.fileProgressBlock}>
                              <Text style={styles.enrichingLabel}>
                                Uploading{" "}
                                {formatR2Progress(r2ImportProgress[f.key])}
                              </Text>
                              <View style={styles.fileProgressTrack}>
                                <View
                                  style={[
                                    styles.progressFill,
                                    {
                                      width: `${
                                        r2ImportProgress[f.key]?.percent || 1
                                      }%`,
                                    },
                                  ]}
                                />
                              </View>
                            </View>
                          ) : r2ProcessingKey === f.key ? (
                            <Text style={styles.enrichingLabel}>
                              Metadata...
                            </Text>
                          ) : f.isDraft ? (
                            <Text style={styles.draftLabel}>Draft saved</Text>
                          ) : null}
                          <TouchableOpacity
                            disabled={isR2Uploading(f.key) || hasR2BulkUpload}
                            onPress={() => handleQuickImportR2File(f)}
                            style={[
                              styles.uploadR2FileBtn,
                              (isR2Uploading(f.key) || hasR2BulkUpload) &&
                                styles.uploadR2FileBtnDisabled,
                            ]}
                          >
                            <Ionicons
                              name="cloud-upload"
                              size={14}
                              color="#FFFFFF"
                            />
                            <Text style={styles.uploadR2FileText}>
                              Import file
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F1A" },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  headerSubtitle: { color: "#8B8FA3", fontSize: 14, marginTop: 4 },
  addBtn: {
    width: 44,
    height: 44,
    backgroundColor: "#4F8EF7",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  importR2Btn: {
    height: 44,
    paddingHorizontal: 14,
    backgroundColor: "#FF9F43",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  importR2Text: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  scrollArea: { paddingHorizontal: 24, paddingBottom: 40 },
  loader: { marginTop: 40, alignItems: "center" },
  loaderText: { color: "#5A5F7A" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#151929",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: "92%",
  },
  modalIndicator: {
    width: 40,
    height: 4,
    backgroundColor: "#2E3654",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1E2540",
    alignItems: "center",
    justifyContent: "center",
  },
  formContainer: { gap: 16, paddingBottom: 24 },
  previewPanel: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "#0B0F1A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E2540",
    padding: 12,
    alignItems: "center",
  },
  previewCover: {
    width: 86,
    height: 118,
    borderRadius: 10,
    backgroundColor: "#1E2540",
  },
  previewText: { flex: 1, minWidth: 0 },
  previewTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  previewAuthor: { color: "#B7BED8", fontSize: 13, marginBottom: 8 },
  previewMeta: { color: "#5A5F7A", fontSize: 11, fontWeight: "700" },
  fieldLabel: {
    color: "#5A5F7A",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  textInput: {
    backgroundColor: "#0B0F1A",
    borderRadius: 15,
    padding: 16,
    color: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#1E2540",
    fontSize: 15,
  },
  row: { flexDirection: "row", gap: 15 },
  submitBtn: {
    backgroundColor: "#4F8EF7",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginTop: 10,
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  metadataApplyBtn: {
    backgroundColor: "#12B886",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  metadataApplyBtnDisabled: {
    opacity: 0.65,
  },
  metadataApplyText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  metadataApplyStatus: {
    color: "#8B8FA3",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: -6,
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#151929",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: "#1E2540",
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: "#FFFFFF",
    fontSize: 15,
  },
  card: {
    backgroundColor: "#151929",
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1E2540",
    overflow: "hidden",
  },
  cardContent: {
    flexDirection: "row",
    padding: 12,
  },
  cover: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: "#1E2540",
  },
  placeholder: {
    backgroundColor: "#1E2540",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  author: {
    color: "#8A8F9E",
    fontSize: 13,
    marginBottom: 2,
  },
  narrator: {
    color: "#8A8F9E",
    fontSize: 12,
    marginBottom: 6,
  },
  sourceBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#2A314A",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceText: {
    color: "#4F8EF7",
    fontSize: 10,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "column",
    justifyContent: "center",
    gap: 8,
    marginLeft: 12,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(79, 142, 247, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    backgroundColor: "rgba(255, 107, 107, 0.1)",
  },
  pathText: { color: "#4F8EF7", fontSize: 12, fontWeight: "600", marginTop: 2 },
  explorerActions: { marginBottom: 15 },
  explorerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backBtnText: { color: "#4F8EF7", fontWeight: "600" },
  bulkImportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bulkImportText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  bulkStatusText: {
    color: "#B7BED8",
    fontSize: 12,
    fontWeight: "700",
  },
  progressBlock: { marginTop: 10, gap: 6 },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#4F8EF7",
  },
  fileProgressBlock: {
    width: 136,
    alignItems: "flex-end",
    gap: 5,
  },
  fileProgressTrack: {
    width: "100%",
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  itemsList: { gap: 4 },
  explorerItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#1E2540",
    borderRadius: 12,
    gap: 12,
    marginBottom: 8,
  },
  fileInfoBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemKey: { color: "#FFFFFF", fontSize: 14, fontWeight: "500", flex: 1 },
  itemSize: { color: "#8B8FA3", fontSize: 11, marginTop: 2 },
  loadingText: { color: "#8B8FA3", textAlign: "center", marginTop: 20 },
  r2ErrorBox: {
    alignItems: "center",
    gap: 12,
    padding: 24,
    backgroundColor: "#1E2540",
    borderRadius: 14,
  },
  r2ErrorText: {
    color: "#FFFFFF",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  r2RetryBtn: {
    backgroundColor: "#FF9F43",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  r2RetryText: { color: "#FFFFFF", fontWeight: "800" },
  r2ActionGroup: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
  },
  uploadR2FileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#16A34A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  uploadR2FileBtnDisabled: {
    opacity: 0.45,
  },
  uploadR2FileText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  importedLabel: { color: "#5A5F7A", fontSize: 11, fontWeight: "700" },
  draftLabel: { color: "#FF9F43", fontSize: 11, fontWeight: "700" },
  enrichingLabel: { color: "#4F8EF7", fontSize: 11, fontWeight: "700" },
});
