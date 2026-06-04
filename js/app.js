/**
 * 阅 · 读书助手 — 纯前端，数据存 localStorage
 */
(function () {
  "use strict";

  const STORAGE_BOOKS = "yue-books-v1";
  const STORAGE_SETTINGS = "yue-settings-v1";

  const DEFAULT_SETTINGS = {
    theme: "light",
    fontSize: 18,
    lineHeight: 1.85,
    margin: 1.2,
    mode: "scroll",
    font: "serif",
  };

  let settings = loadSettings();
  let books = migrateBooks(loadBooks());
  let currentBookId = null;
  let pages = [];
  let currentPage = 0;
  let addBookType = "physical";
  let editingNoteId = null;
  let expandedNoteId = null;
  let actionBookId = null;
  let noteEditReturnView = "notes";

  const app = document.getElementById("app");
  const viewShelf = document.getElementById("view-shelf");
  const viewReader = document.getElementById("view-reader");
  const viewNotes = document.getElementById("view-notes");
  const viewNoteEdit = document.getElementById("view-note-edit");
  const bookList = document.getElementById("book-list");
  const shelfEmpty = document.getElementById("shelf-empty");
  const readerContent = document.getElementById("reader-content");
  const readerTitle = document.getElementById("reader-title");
  const readerProgressText = document.getElementById("reader-progress-text");
  const progressFill = document.getElementById("progress-fill");
  const readerWordCount = document.getElementById("reader-word-count");
  const tapZones = document.getElementById("tap-zones");

  const notesBookTitle = document.getElementById("notes-book-title");
  const notesBookMeta = document.getElementById("notes-book-meta");
  const notesList = document.getElementById("notes-list");
  const notesEmpty = document.getElementById("notes-empty");

  const dialogAdd = document.getElementById("dialog-add");
  const dialogSettings = document.getElementById("dialog-settings");
  const dialogBookActions = document.getElementById("dialog-book-actions");
  const formAdd = document.getElementById("form-add");
  const formNoteEdit = document.getElementById("form-note-edit");
  const inputTitle = document.getElementById("input-title");
  const inputAuthor = document.getElementById("input-author");
  const inputContent = document.getElementById("input-content");
  const inputFile = document.getElementById("input-file");
  const digitalFields = document.getElementById("digital-fields");
  const actionBookTitle = document.getElementById("action-book-title");

  const noteEditHeading = document.getElementById("note-edit-heading");
  const noteEditSubtitle = document.getElementById("note-edit-subtitle");
  const noteEditChapter = document.getElementById("note-edit-chapter");
  const noteEditContent = document.getElementById("note-edit-content");
  const noteEditQuestion = document.getElementById("note-edit-question");
  const noteEditReflection = document.getElementById("note-edit-reflection");
  const btnNoteDelete = document.getElementById("btn-note-delete");

  function migrateNote(note) {
    return {
      question: "",
      reflection: "",
      order: null,
      ...note,
      question: note.question || "",
      reflection: note.reflection || "",
    };
  }

  function ensureBookNoteOrders(notes) {
    if (!notes.length) return;
    const needsInit = notes.some((n) => n.order == null || !Number.isFinite(n.order));
    if (!needsInit) {
      notes.sort((a, b) => a.order - b.order);
      return;
    }
    notes.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    notes.forEach((n, i) => {
      n.order = i;
    });
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
  }

  function loadBooks() {
    try {
      const raw = localStorage.getItem(STORAGE_BOOKS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function migrateBooks(list) {
    return list.map((book) => {
      const hasContent = Boolean(book.content?.trim());
      const notes = Array.isArray(book.notes) ? book.notes.map(migrateNote) : [];
      ensureBookNoteOrders(notes);
      return {
        author: "",
        notes: [],
        ...book,
        type: book.type || (hasContent ? "digital" : "physical"),
        notes,
      };
    });
  }

  function saveBooks() {
    localStorage.setItem(STORAGE_BOOKS, JSON.stringify(books));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function getBook(id) {
    return books.find((b) => b.id === id) || null;
  }

  function isPhysicalBook(book) {
    return book.type === "physical" || !book.content?.trim();
  }

  function touchBook(book) {
    book.updatedAt = Date.now();
    saveBooks();
  }

  function countWords(text) {
    if (!text) return 0;
    const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const words = text
      .replace(/[\u4e00-\u9fff]/g, " ")
      .split(/\s+/)
      .filter(Boolean).length;
    return cjk + words;
  }

  function formatWordCount(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + " 万字";
    return n + " 字";
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return "今天 " + d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  }

  function formatNoteTime(ts) {
    return new Date(ts).toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function guessTitle(content) {
    const first = content.trim().split(/\n/)[0]?.trim() || "";
    if (first.length > 0 && first.length <= 40) return first;
    return "未命名书籍";
  }

  function contentToParagraphs(content) {
    return content
      .replace(/\r\n/g, "\n")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function applySettings() {
    document.documentElement.setAttribute("data-theme", settings.theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const colors = { light: "#f5f0e8", sepia: "#e8dcc8", dark: "#1a1814" };
    if (metaTheme) metaTheme.content = colors[settings.theme] || colors.light;

    if (readerContent) {
      readerContent.style.fontSize = settings.fontSize + "px";
      readerContent.style.lineHeight = String(settings.lineHeight);
      readerContent.style.padding = `${settings.margin}rem`;
      readerContent.classList.toggle("font-sans", settings.font === "sans");
      readerContent.classList.toggle("mode-page", settings.mode === "page");
    }

    tapZones.classList.toggle("hidden", settings.mode !== "page");
    syncSettingsUI();
  }

  function syncSettingsUI() {
    const dialog = document.getElementById("dialog-settings");
    if (!dialog) return;

    dialog.querySelectorAll("[data-theme]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.theme === settings.theme);
    });
    dialog.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === settings.mode);
    });
    dialog.querySelectorAll("[data-font]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.font === settings.font);
    });

    const fs = document.getElementById("range-font-size");
    const lh = document.getElementById("range-line-height");
    const mg = document.getElementById("range-margin");
    if (fs) fs.value = settings.fontSize;
    if (lh) lh.value = settings.lineHeight;
    if (mg) mg.value = settings.margin;

    const outFs = document.getElementById("out-font-size");
    const outLh = document.getElementById("out-line-height");
    const outMg = document.getElementById("out-margin");
    if (outFs) outFs.textContent = settings.fontSize;
    if (outLh) outLh.textContent = settings.lineHeight;
    if (outMg) outMg.textContent = settings.margin;
  }

  function openSettingsDialog() {
    syncSettingsUI();
    dialogSettings.showModal();
  }

  function showView(name) {
    app.dataset.view = name;
    viewShelf.classList.toggle("hidden", name !== "shelf");
    viewReader.classList.toggle("hidden", name !== "reader");
    viewNotes.classList.toggle("hidden", name !== "notes");
    viewNoteEdit.classList.toggle("hidden", name !== "note-edit");
  }

  function openBookEntry(id) {
    const book = getBook(id);
    if (!book) return;
    if (isPhysicalBook(book)) {
      openNotes(id);
    } else {
      openReader(id);
    }
  }

  function getBookShelfMeta(book) {
    const noteCount = book.notes?.length || 0;
    if (isPhysicalBook(book)) {
      return `${noteCount} 条笔记 · ${formatDate(book.updatedAt)}`;
    }
    return `${formatWordCount(countWords(book.content))} · ${formatDate(book.updatedAt)}`;
  }

  function renderShelf() {
    const hasBooks = books.length > 0;
    shelfEmpty.classList.toggle("hidden", hasBooks);
    bookList.classList.toggle("hidden", !hasBooks);
    bookList.innerHTML = "";

    const sorted = [...books].sort((a, b) => b.updatedAt - a.updatedAt);

    sorted.forEach((book) => {
      const physical = isPhysicalBook(book);
      const noteCount = book.notes?.length || 0;
      const progressBlock = physical
        ? `<p class="book-badge">${noteCount} 条笔记</p>`
        : `<div class="book-progress-track">
             <div class="book-progress-bar" style="width:${book.progress}%"></div>
           </div>
           <p class="book-percent">已读 ${Math.round(book.progress)}%</p>`;

      const li = document.createElement("li");
      li.innerHTML = `
        <button type="button" class="book-card" data-id="${book.id}">
          <span class="book-spine" aria-hidden="true"></span>
          <span class="book-info">
            <h3 class="book-title">
              ${escapeHtml(book.title)}
              <span class="book-type-tag">${physical ? "实体书" : "电子书"}</span>
            </h3>
            <p class="book-meta">${escapeHtml(getBookShelfMeta(book))}</p>
            ${progressBlock}
          </span>
        </button>
      `;
      bookList.appendChild(li);
    });
  }

  function sortNotes(notes) {
    return [...notes].sort((a, b) => {
      const oa = Number.isFinite(a.order) ? a.order : Infinity;
      const ob = Number.isFinite(b.order) ? b.order : Infinity;
      if (oa !== ob) return oa - ob;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  function nextNoteOrder(notes) {
    if (!notes.length) return 0;
    return Math.max(...notes.map((n) => (Number.isFinite(n.order) ? n.order : 0))) + 1;
  }

  function persistNoteOrderFromDom() {
    const book = getBook(currentBookId);
    if (!book) return;
    const ids = [...notesList.querySelectorAll(".note-item")].map((el) => el.dataset.noteId);
    ids.forEach((id, index) => {
      const note = book.notes.find((n) => n.id === id);
      if (note) note.order = index;
    });
    touchBook(book);
  }

  function getNoteDragAfterElement(y) {
    const items = [...notesList.querySelectorAll(".note-item:not(.is-dragging-floating)")];
    let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
    items.forEach((child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        closest = { offset, element: child };
      }
    });
    return closest.element;
  }

  function movePlaceholderWithAnimation(placeholder, after) {
    const items = [...notesList.querySelectorAll(".note-item:not(.is-dragging-floating)")];
    const firstRects = new Map(
      items.map((el) => [el, el.getBoundingClientRect()])
    );

    if (after == null) {
      notesList.appendChild(placeholder);
    } else {
      notesList.insertBefore(placeholder, after);
    }

    requestAnimationFrame(() => {
      items.forEach((el) => {
        const first = firstRects.get(el);
        if (!first) return;
        const last = el.getBoundingClientRect();
        const dy = first.top - last.top;
        if (Math.abs(dy) < 1) return;

        el.classList.add("is-flipping");
        el.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => {
          el.style.transform = "";
        });
      });
    });
  }

  function clearFlipTransforms() {
    notesList.querySelectorAll(".note-item.is-flipping").forEach((el) => {
      el.classList.remove("is-flipping");
      el.style.transform = "";
    });
  }

  function bindNoteDragReorder() {
    if (notesList.dataset.dragBound) return;
    notesList.dataset.dragBound = "1";

    const LONG_PRESS_MS = 420;
    const MOVE_CANCEL_PX = 12;

    let dragState = null;
    let pending = null;

    function cancelPending() {
      if (!pending) return;
      clearTimeout(pending.timer);
      pending.handle.classList.remove("is-press-waiting");
      pending = null;
    }

    function startFloatingDrag(item, handle, clientX, clientY, pointerId) {
      const rect = item.getBoundingClientRect();
      const placeholder = document.createElement("li");
      placeholder.className = "note-item note-drag-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.style.height = `${rect.height}px`;

      notesList.insertBefore(placeholder, item);
      item.classList.add("is-dragging-floating");
      item.style.width = `${rect.width}px`;
      item.style.left = `${rect.left}px`;
      item.style.top = `${rect.top}px`;
      document.body.appendChild(item);

      notesList.classList.add("is-sorting");
      document.body.classList.add("is-note-dragging");

      dragState = {
        item,
        placeholder,
        handle,
        offsetY: clientY - rect.top,
        moved: false,
        pointerId,
      };

      requestAnimationFrame(() => item.classList.add("is-dragging-active"));

      try {
        handle.setPointerCapture(pointerId);
      } catch {
        /* 部分环境 setPointerCapture 不可用 */
      }
    }

    function onDocumentPointerMove(e) {
      if (pending && !dragState && e.pointerId === pending.pointerId) {
        const dx = e.clientX - pending.startX;
        const dy = e.clientY - pending.startY;
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) cancelPending();
        return;
      }

      if (!dragState || e.pointerId !== dragState.pointerId) return;
      e.preventDefault();

      const { item, placeholder, offsetY } = dragState;
      dragState.moved = true;
      item.style.top = `${e.clientY - offsetY}px`;

      const after = getNoteDragAfterElement(e.clientY);
      const prevNext = placeholder.nextElementSibling;
      if (after == null) {
        if (placeholder !== notesList.lastElementChild) {
          movePlaceholderWithAnimation(placeholder, null);
        }
      } else if (after !== placeholder && after !== prevNext) {
        movePlaceholderWithAnimation(placeholder, after);
      }
    }

    function endDrag(e) {
      if (!dragState || e.pointerId !== dragState.pointerId) return;

      const { item, placeholder, handle, moved, pointerId } = dragState;

      try {
        if (handle?.hasPointerCapture?.(pointerId)) {
          handle.releasePointerCapture(pointerId);
        }
      } catch {
        /* ignore */
      }

      item.classList.remove("is-dragging-active");
      const destRect = placeholder.getBoundingClientRect();
      item.style.left = `${destRect.left}px`;
      item.style.top = `${destRect.top}px`;
      item.style.width = `${destRect.width}px`;

      const finish = () => {
        item.classList.remove("is-dragging-floating", "is-dragging-active", "is-snapping");
        item.style.left = "";
        item.style.top = "";
        item.style.width = "";
        notesList.insertBefore(item, placeholder);
        placeholder.remove();
        notesList.classList.remove("is-sorting");
        document.body.classList.remove("is-note-dragging");
        clearFlipTransforms();

        if (moved) {
          persistNoteOrderFromDom();
          notesList.dataset.justDragged = "1";
          setTimeout(() => delete notesList.dataset.justDragged, 320);
        }

        dragState = null;
      };

      const onSnapEnd = (ev) => {
        if (ev.propertyName !== "transform" && ev.propertyName !== "top") return;
        item.removeEventListener("transitionend", onSnapEnd);
        finish();
      };

      item.addEventListener("transitionend", onSnapEnd);
      requestAnimationFrame(() => item.classList.add("is-snapping"));

      setTimeout(() => {
        if (!dragState) return;
        item.removeEventListener("transitionend", onSnapEnd);
        finish();
      }, 320);
    }

    function onDocumentPointerUp(e) {
      if (pending && e.pointerId === pending.pointerId) {
        cancelPending();
        return;
      }
      endDrag(e);
    }

    document.addEventListener("pointermove", onDocumentPointerMove, { passive: false });
    document.addEventListener("pointerup", onDocumentPointerUp);
    document.addEventListener("pointercancel", onDocumentPointerUp);

    notesList.addEventListener(
      "pointerdown",
      (e) => {
        const handle = e.target.closest(".note-drag-handle");
        if (!handle || dragState) return;

        const item = handle.closest(".note-item");
        if (!item) return;

        e.stopPropagation();
        cancelPending();

        const isTouch = e.pointerType === "touch";

        if (isTouch) {
          pending = {
            handle,
            item,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            timer: setTimeout(() => {
              if (!pending) return;
              const p = pending;
              cancelPending();
              startFloatingDrag(p.item, p.handle, p.startX, p.startY, p.pointerId);
            }, LONG_PRESS_MS),
          };
          handle.classList.add("is-press-waiting");
        } else {
          e.preventDefault();
          startFloatingDrag(item, handle, e.clientX, e.clientY, e.pointerId);
        }
      },
      { passive: false }
    );
  }

  function getFirstSentence(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return "";
    const line = trimmed.split("\n")[0].trim();
    const match = line.match(/^[^。！？.!?\n]+[。！？.!?]?/);
    const sentence = match ? match[0].trim() : line;
    return sentence.length > 48 ? sentence.slice(0, 48) + "…" : sentence;
  }

  function getNotePreview(note) {
    return (
      getFirstSentence(note.content) ||
      getFirstSentence(note.question) ||
      getFirstSentence(note.reflection) ||
      "（空笔记）"
    );
  }

  function getNoteTitle(note) {
    if (note.chapter?.trim()) return note.chapter.trim();
    return "未分章";
  }

  function renderNoteBody(note) {
    const parts = [];
    if (note.content?.trim()) {
      parts.push(`<p class="note-section-text">${escapeHtml(note.content)}</p>`);
    }
    if (note.question?.trim()) {
      parts.push(`<p class="note-section-label">疑问</p><p class="note-section-text">${escapeHtml(note.question)}</p>`);
    }
    if (note.reflection?.trim()) {
      parts.push(`<p class="note-section-label">感想</p><p class="note-section-text">${escapeHtml(note.reflection)}</p>`);
    }
    return parts.join("") || `<p class="note-section-text">（空笔记）</p>`;
  }

  function noteHasContent(fields) {
    return Boolean(
      fields.content?.trim() ||
        fields.question?.trim() ||
        fields.reflection?.trim()
    );
  }

  function toggleNoteExpand(noteId) {
    expandedNoteId = expandedNoteId === noteId ? null : noteId;
    notesList.querySelectorAll(".note-card").forEach((card) => {
      const open = card.dataset.noteId === expandedNoteId;
      card.classList.toggle("is-expanded", open);
      card.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function renderNotesView() {
    const book = getBook(currentBookId);
    if (!book) return;

    notesBookTitle.textContent = book.title;
    const authorPart = book.author ? `${book.author} · ` : "";
    const noteCount = book.notes?.length || 0;
    notesBookMeta.textContent = `${authorPart}${noteCount} 条笔记`;

    const sorted = sortNotes(book.notes || []);
    notesEmpty.classList.toggle("hidden", sorted.length > 0);
    notesList.classList.toggle("hidden", sorted.length === 0);
    notesList.innerHTML = "";

    sorted.forEach((note) => {
      const li = document.createElement("li");
      const isExpanded = expandedNoteId === note.id;
      const preview = getNotePreview(note);

      li.className = "note-item";
      li.dataset.noteId = note.id;
      li.innerHTML = `
        <div class="note-drag-handle" role="button" tabindex="0" aria-label="长按拖动调整顺序" title="长按排序">⠿</div>
        <div class="note-card${isExpanded ? " is-expanded" : ""}" data-note-id="${note.id}" role="button" tabindex="0" aria-expanded="${isExpanded}">
          <div class="note-card-head">
            <div class="note-card-title-row">
              <h4 class="note-title">${escapeHtml(getNoteTitle(note))}</h4>
            </div>
            <span class="note-time">${formatNoteTime(note.updatedAt || note.createdAt)}</span>
          </div>
          <p class="note-preview">${escapeHtml(preview)}</p>
          <div class="note-full">
            ${renderNoteBody(note)}
            <button type="button" class="btn btn-ghost btn-sm note-edit-btn">编辑</button>
          </div>
        </div>
      `;
      notesList.appendChild(li);
    });
    bindNoteDragReorder();
  }

  function openNotes(id) {
    currentBookId = id;
    expandedNoteId = null;
    renderNotesView();
    showView("notes");
  }

  function openNoteEditor(noteId) {
    const book = getBook(currentBookId);
    if (!book) return;

    editingNoteId = noteId || null;
    const note = noteId ? book.notes.find((n) => n.id === noteId) : null;

    noteEditHeading.textContent = note ? "编辑笔记" : "记笔记";
    noteEditSubtitle.textContent = book.title;

    if (note) {
      noteEditChapter.value = note.chapter || "";
      noteEditContent.value = note.content || "";
      noteEditQuestion.value = note.question || "";
      noteEditReflection.value = note.reflection || "";
      btnNoteDelete.classList.remove("hidden");
    } else {
      noteEditChapter.value = "";
      noteEditContent.value = "";
      noteEditQuestion.value = "";
      noteEditReflection.value = "";
      btnNoteDelete.classList.add("hidden");
    }

    noteEditReturnView = "notes";
    showView("note-edit");
    setTimeout(() => {
      (noteEditChapter.value ? noteEditContent : noteEditChapter).focus();
    }, 80);
  }

  function closeNoteEditor() {
    if (noteEditReturnView === "notes" && currentBookId) {
      renderNotesView();
      showView("notes");
    } else if (currentBookId) {
      openNotes(currentBookId);
    } else {
      showView("shelf");
    }
  }

  function saveNote() {
    const book = getBook(currentBookId);
    if (!book) return false;

    const fields = {
      chapter: noteEditChapter.value.trim(),
      content: noteEditContent.value.trim(),
      question: noteEditQuestion.value.trim(),
      reflection: noteEditReflection.value.trim(),
    };

    if (!noteHasContent(fields)) {
      alert("请至少填写笔记内容、疑问或感想中的一项。");
      return false;
    }

    const now = Date.now();

    if (editingNoteId) {
      const note = book.notes.find((n) => n.id === editingNoteId);
      if (!note) return false;
      Object.assign(note, fields, { updatedAt: now });
    } else {
      book.notes.push({
        id: uid(),
        ...fields,
        order: nextNoteOrder(book.notes),
        createdAt: now,
        updatedAt: now,
      });
    }

    touchBook(book);
    editingNoteId = null;
    renderShelf();
    closeNoteEditor();
    return true;
  }

  function deleteNote() {
    const book = getBook(currentBookId);
    if (!book || !editingNoteId) return;
    if (!confirm("确定删除这条笔记吗？")) return;

    book.notes = book.notes.filter((n) => n.id !== editingNoteId);
    ensureBookNoteOrders(book.notes);
    if (expandedNoteId === editingNoteId) expandedNoteId = null;
    touchBook(book);
    editingNoteId = null;
    renderShelf();
    closeNoteEditor();
  }

  function openReader(id) {
    const book = getBook(id);
    if (!book || isPhysicalBook(book)) return;

    currentBookId = id;
    readerTitle.textContent = book.title;
    readerWordCount.textContent = formatWordCount(countWords(book.content));

    applySettings();
    renderReaderContent(book);

    if (settings.mode === "scroll") {
      requestAnimationFrame(() => {
        const maxScroll = readerContent.scrollHeight - readerContent.clientHeight;
        readerContent.scrollTop = (book.progress / 100) * maxScroll;
        updateScrollProgress();
      });
    } else {
      currentPage = progressToPage(book.progress, pages.length);
      renderPage(currentPage);
      updatePageProgress();
    }

    showView("reader");
  }

  function renderReaderContent(book) {
    const paragraphs = contentToParagraphs(book.content);
    if (settings.mode === "page") {
      pages = paginate(paragraphs);
      readerContent.innerHTML = "";
    } else {
      readerContent.innerHTML = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    }
  }

  function paginate(paragraphs) {
    const measure = document.createElement("div");
    measure.style.cssText = window.getComputedStyle(readerContent).cssText;
    measure.style.position = "absolute";
    measure.style.visibility = "hidden";
    measure.style.height = readerContent.clientHeight + "px" || "500px";
    measure.style.overflow = "hidden";
    measure.style.width = readerContent.clientWidth + "px" || "100%";
    measure.className = readerContent.className;
    document.body.appendChild(measure);

    const maxH = measure.clientHeight || window.innerHeight * 0.65;
    const result = [];
    let current = [];

    paragraphs.forEach((para) => {
      const test = [...current, para];
      measure.innerHTML = test.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
      if (measure.scrollHeight > maxH && current.length > 0) {
        result.push([...current]);
        current = [para];
      } else {
        current = test;
      }
    });

    if (current.length) result.push(current);
    document.body.removeChild(measure);

    return result.length ? result : [paragraphs.length ? paragraphs : ["（空内容）"]];
  }

  function progressToPage(progress, total) {
    if (total <= 1) return 0;
    return Math.min(total - 1, Math.round((progress / 100) * (total - 1)));
  }

  function pageToProgress(page, total) {
    if (total <= 1) return 100;
    return (page / (total - 1)) * 100;
  }

  function renderPage(index) {
    if (!pages.length) return;
    currentPage = Math.max(0, Math.min(index, pages.length - 1));
    const paras = pages[currentPage];
    readerContent.innerHTML = paras.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  }

  function saveProgress(percent) {
    if (!currentBookId) return;
    const book = getBook(currentBookId);
    if (!book || isPhysicalBook(book)) return;
    book.progress = Math.min(100, Math.max(0, percent));
    book.updatedAt = Date.now();
    saveBooks();
  }

  function updateScrollProgress() {
    const el = readerContent;
    const max = el.scrollHeight - el.clientHeight;
    const percent = max <= 0 ? 100 : (el.scrollTop / max) * 100;
    setProgressUI(percent);
    saveProgress(percent);
  }

  function updatePageProgress() {
    const percent = pageToProgress(currentPage, pages.length);
    setProgressUI(percent);
    saveProgress(percent);
  }

  function setProgressUI(percent) {
    const rounded = Math.round(percent);
    progressFill.style.width = percent + "%";
    readerProgressText.textContent = rounded + "%";
  }

  function toggleFocusMode() {
    viewReader.classList.toggle("focus-mode");
  }

  function setAddBookType(type) {
    addBookType = type;
    document.querySelectorAll("[data-book-type]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.bookType === type);
    });
    digitalFields.classList.toggle("hidden", type !== "digital");
    document.getElementById("field-author").classList.toggle("hidden", type === "digital");
  }

  function openAddDialog() {
    inputTitle.value = "";
    inputAuthor.value = "";
    inputContent.value = "";
    inputFile.value = "";
    setAddBookType("physical");
    dialogAdd.showModal();
    setTimeout(() => inputTitle.focus(), 100);
  }

  function addBook({ title, author, content, type }) {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (type === "physical" && !trimmedTitle) return false;
    if (type === "digital" && !trimmedContent) return false;

    const book = {
      id: uid(),
      title:
        trimmedTitle ||
        (type === "digital" ? guessTitle(trimmedContent) : "未命名书籍"),
      author: author.trim(),
      content: type === "digital" ? trimmedContent : "",
      type,
      notes: [],
      progress: 0,
      updatedAt: Date.now(),
    };

    books.push(book);
    saveBooks();
    renderShelf();
    return book.id;
  }

  function openBookActions(id) {
    const book = getBook(id);
    if (!book) return;
    actionBookId = id;
    actionBookTitle.textContent = book.title;

    document.getElementById("action-restart").classList.toggle("hidden", isPhysicalBook(book));
    document.getElementById("action-notes").classList.toggle("hidden", isPhysicalBook(book));

    dialogBookActions.showModal();
  }

  function bindEvents() {
    document.getElementById("btn-add-book").addEventListener("click", openAddDialog);
    document.getElementById("btn-add-first").addEventListener("click", openAddDialog);
    document.getElementById("btn-shelf-settings").addEventListener("click", openSettingsDialog);
    document.getElementById("btn-notes-settings").addEventListener("click", openSettingsDialog);

    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.closest("dialog")?.close();
      });
    });

    document.querySelectorAll("[data-book-type]").forEach((btn) => {
      btn.addEventListener("click", () => setAddBookType(btn.dataset.bookType));
    });

    formAdd.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = addBook({
        title: inputTitle.value,
        author: inputAuthor.value,
        content: inputContent.value,
        type: addBookType,
      });
      dialogAdd.close();
      if (id) openBookEntry(id);
    });

    inputFile.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        inputContent.value = text;
        setAddBookType("digital");
        if (!inputTitle.value.trim()) {
          inputTitle.value = file.name.replace(/\.(txt|md|text)$/i, "");
        }
      } catch {
        alert("无法读取文件，请尝试复制粘贴内容。");
      }
    });

    bookList.addEventListener("click", (e) => {
      const card = e.target.closest(".book-card");
      if (!card) return;
      const id = card.dataset.id;
      if (e.shiftKey) {
        openBookActions(id);
      } else {
        openBookEntry(id);
      }
    });

    bookList.addEventListener("contextmenu", (e) => {
      const card = e.target.closest(".book-card");
      if (!card) return;
      e.preventDefault();
      openBookActions(card.dataset.id);
    });

    document.getElementById("btn-back").addEventListener("click", () => {
      viewReader.classList.remove("focus-mode");
      renderShelf();
      showView("shelf");
      currentBookId = null;
    });

    document.getElementById("btn-notes-back").addEventListener("click", () => {
      const book = getBook(currentBookId);
      if (book && !isPhysicalBook(book)) {
        openReader(currentBookId);
        return;
      }
      renderShelf();
      showView("shelf");
      currentBookId = null;
    });

    document.getElementById("btn-notes-more").addEventListener("click", () => {
      if (currentBookId) openBookActions(currentBookId);
    });

    document.getElementById("btn-add-note").addEventListener("click", () => openNoteEditor());
    document.getElementById("btn-reader-notes").addEventListener("click", () => {
      if (currentBookId) openNotes(currentBookId);
    });

    document.getElementById("btn-note-edit-back").addEventListener("click", closeNoteEditor);
    document.getElementById("btn-note-save").addEventListener("click", saveNote);
    btnNoteDelete.addEventListener("click", deleteNote);
    formNoteEdit.addEventListener("submit", (e) => {
      e.preventDefault();
      saveNote();
    });

    notesList.addEventListener("click", (e) => {
      if (
        e.target.closest(".note-drag-handle") ||
        notesList.dataset.justDragged ||
        notesList.classList.contains("is-sorting")
      )
        return;

      const editBtn = e.target.closest(".note-edit-btn");
      if (editBtn) {
        e.stopPropagation();
        const card = editBtn.closest(".note-card");
        if (card) openNoteEditor(card.dataset.noteId);
        return;
      }

      const card = e.target.closest(".note-card");
      if (!card) return;
      toggleNoteExpand(card.dataset.noteId);
    });

    notesList.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".note-card");
      if (!card || e.target.closest(".note-edit-btn")) return;
      e.preventDefault();
      toggleNoteExpand(card.dataset.noteId);
    });

    document.getElementById("btn-settings").addEventListener("click", openSettingsDialog);

    document.getElementById("form-settings").addEventListener("submit", (e) => {
      e.preventDefault();
      saveSettings();
      dialogSettings.close();
      if (currentBookId && !isPhysicalBook(getBook(currentBookId))) {
        const book = getBook(currentBookId);
        if (book) {
          const progress = book.progress;
          applySettings();
          renderReaderContent(book);
          if (settings.mode === "scroll") {
            requestAnimationFrame(() => {
              const maxScroll = readerContent.scrollHeight - readerContent.clientHeight;
              readerContent.scrollTop = (progress / 100) * maxScroll;
              updateScrollProgress();
            });
          } else {
            currentPage = progressToPage(progress, pages.length);
            renderPage(currentPage);
            updatePageProgress();
          }
        }
      } else {
        applySettings();
      }
    });

    const settingsDialog = document.getElementById("dialog-settings");
    settingsDialog.querySelectorAll("[data-theme]").forEach((btn) => {
      btn.addEventListener("click", () => {
        settings.theme = btn.dataset.theme;
        applySettings();
        saveSettings();
      });
    });
    settingsDialog.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        settings.mode = btn.dataset.mode;
        applySettings();
        saveSettings();
      });
    });
    settingsDialog.querySelectorAll("[data-font]").forEach((btn) => {
      btn.addEventListener("click", () => {
        settings.font = btn.dataset.font;
        applySettings();
        saveSettings();
      });
    });

    document.getElementById("range-font-size").addEventListener("input", (e) => {
      settings.fontSize = Number(e.target.value);
      document.getElementById("out-font-size").textContent = settings.fontSize;
      applySettings();
      saveSettings();
    });
    document.getElementById("range-line-height").addEventListener("input", (e) => {
      settings.lineHeight = Number(e.target.value);
      document.getElementById("out-line-height").textContent = settings.lineHeight;
      applySettings();
      saveSettings();
    });
    document.getElementById("range-margin").addEventListener("input", (e) => {
      settings.margin = Number(e.target.value);
      document.getElementById("out-margin").textContent = settings.margin;
      applySettings();
      saveSettings();
    });

    let scrollTimer;
    readerContent.addEventListener("scroll", () => {
      if (settings.mode !== "scroll") return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(updateScrollProgress, 80);
    });

    document.getElementById("btn-scroll-top").addEventListener("click", () => {
      if (settings.mode === "page") {
        renderPage(0);
        updatePageProgress();
      } else {
        readerContent.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    document.getElementById("tap-prev").addEventListener("click", () => {
      if (currentPage > 0) {
        renderPage(currentPage - 1);
        updatePageProgress();
      }
    });
    document.getElementById("tap-next").addEventListener("click", () => {
      if (currentPage < pages.length - 1) {
        renderPage(currentPage + 1);
        updatePageProgress();
      }
    });
    document.getElementById("tap-center").addEventListener("click", toggleFocusMode);

    document.getElementById("action-open").addEventListener("click", () => {
      dialogBookActions.close();
      if (actionBookId) openBookEntry(actionBookId);
    });
    document.getElementById("action-notes").addEventListener("click", () => {
      dialogBookActions.close();
      if (actionBookId) openNotes(actionBookId);
    });
    document.getElementById("action-restart").addEventListener("click", () => {
      const book = getBook(actionBookId);
      if (book && !isPhysicalBook(book)) {
        book.progress = 0;
        book.updatedAt = Date.now();
        saveBooks();
        renderShelf();
      }
      dialogBookActions.close();
      if (actionBookId) openReader(actionBookId);
    });
    document.getElementById("action-delete").addEventListener("click", () => {
      if (!actionBookId) return;
      if (!confirm("确定从书架删除这本书吗？笔记也会一并删除。")) return;
      books = books.filter((b) => b.id !== actionBookId);
      saveBooks();
      renderShelf();
      dialogBookActions.close();
      if (currentBookId === actionBookId) {
        currentBookId = null;
        showView("shelf");
      }
      actionBookId = null;
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      if (settings.mode !== "page" || !currentBookId) return;
      const book = getBook(currentBookId);
      if (!book || isPhysicalBook(book)) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const progress = book.progress;
        renderReaderContent(book);
        currentPage = progressToPage(progress, pages.length);
        renderPage(currentPage);
        updatePageProgress();
      }, 200);
    });

    document.getElementById("form-settings").addEventListener("close", saveSettings);
  }

  function init() {
    applySettings();
    bindEvents();
    renderShelf();

    if (books.length === 0 && !localStorage.getItem("yue-demo-seeded-v3")) {
      localStorage.setItem("yue-demo-seeded-v3", "1");
      const id = addBook({
        title: "示例 · 实体书笔记用法",
        author: "读书助手",
        content: "",
        type: "physical",
      });
      const book = getBook(id);
      if (book) {
        book.notes = [
          {
            id: uid(),
            chapter: "第一章",
            content:
              "「人是为了活着本身而活着，而不是为了活着之外的任何事物而活着。」",
            question: "",
            reflection: "这句话点出了全书的核心，读后仍有余韵。",
            order: 0,
            createdAt: Date.now() - 86400000,
            updatedAt: Date.now() - 86400000,
          },
          {
            id: uid(),
            chapter: "第二章",
            content: "",
            question: "为什么主角在这个时候做出了这个选择？",
            reflection: "",
            order: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ];
        saveBooks();
      }
      renderShelf();
    }
  }

  init();
})();
