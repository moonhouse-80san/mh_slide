var selected_node = null;
var item_seq = 0;

function toggleAllEffects(all_checkbox) {
	var items = document.getElementsByClassName('effect_item');
	for (var i = 0; i < items.length; i++) {
		items[i].checked = all_checkbox.checked;
	}
}

function syncEffectAllState() {
	var items = document.getElementsByClassName('effect_item');
	var all_checked = true;
	for (var i = 0; i < items.length; i++) {
		if (!items[i].checked) { all_checked = false; break; }
	}
	var all_checkbox = document.getElementsByClassName('effect_all')[0];
	if (all_checkbox) all_checkbox.checked = all_checked;
}

/* ── 이미지 항목(썸네일+캡션) 카드 추가 ── */
function addImageItem(preset) {
	preset = preset || {};
	item_seq++;
	var seq = item_seq;

	var wrap = document.createElement('div');
	wrap.className = 'mh_slide_item';
	wrap.id = 'item_' + seq;
	wrap.draggable = false;
	if (preset.src) wrap.setAttribute('data-src', preset.src);

	var handle = document.createElement('div');
	handle.className = 'item-drag-handle';
	handle.title = '드래그하여 순서 변경';
	handle.innerHTML = '&#9776;';

	var btnDel = document.createElement('button');
	btnDel.type = 'button';
	btnDel.className = 'btn-del-item';
	btnDel.title = '삭제';
	btnDel.textContent = '\u00D7';
	btnDel.addEventListener('click', (function(s) {
		return function() { removeImageItem(s); };
	})(seq));

	var thumb = document.createElement('div');
	thumb.className = 'item-thumb';

	var img = document.createElement('img');
	img.alt = '';

	var fileInput = document.createElement('input');
	fileInput.type = 'file';
	fileInput.accept = 'image/*';

	var reBtn = document.createElement('button');
	reBtn.type = 'button';
	reBtn.className = 'btn-reupload';
	reBtn.textContent = '변경';
	reBtn.style.display = 'none';
	reBtn.addEventListener('click', function(e) {
		e.stopPropagation();
		fileInput.click();
	});

	thumb.appendChild(img);
	thumb.appendChild(fileInput);
	thumb.appendChild(reBtn);

	var status = document.createElement('div');
	status.className = 'item-status';

	var caption = document.createElement('input');
	caption.type = 'text';
	caption.className = 'item-caption';
	caption.placeholder = '캡션 (선택 입력)';
	caption.value = preset.caption || '';

	wrap.appendChild(handle);
	wrap.appendChild(btnDel);
	wrap.appendChild(thumb);
	wrap.appendChild(status);
	wrap.appendChild(caption);

	get_by_id('item-list').appendChild(wrap);

	initDragReorder(wrap, handle);

	if (preset.src) {
		img.src = preset.src;
		thumb.className = 'item-thumb has-image';
		fileInput.style.display = 'none';
		reBtn.style.display = 'block';
	}

	fileInput.addEventListener('change', function() {
		var f = this.files && this.files[0];
		this.value = '';
		if (!f) return;
		uploadItemFile(f, wrap, img, thumb, fileInput, reBtn, status);
	});

	return wrap;
}

function removeImageItem(seq) {
	var el = get_by_id('item_' + seq);
	if (!el) return;
	var file_srl = el.getAttribute('data-file-srl');
	if (file_srl) deleteEditorFile(file_srl);
	el.parentNode.removeChild(el);
}

/* ── 에디터에 업로드된 파일을 실제로 삭제(정리) ── */
function deleteEditorFile(file_srl) {
	if (!file_srl) return;
	var fo = get_by_id('fo');
	jQuery.ajax({
		url: './index.php?module=file&act=procFileDelete',
		type: 'POST',
		data: {
			editor_sequence: fo.editor_sequence.value,
			file_srl: file_srl
		},
		dataType: 'json'
	});
	// 실패하더라도 사용자 작업 흐름을 막지 않기 위해 별도 처리는 하지 않음(백그라운드 정리 목적)
}

/* ── 드래그 앤 드롭으로 이미지 순서 변경 ── */
var drag_src_el = null;

function initDragReorder(wrap, handle) {
	handle.addEventListener('mousedown', function() {
		wrap.draggable = true;
	});

	wrap.addEventListener('dragstart', function(e) {
		drag_src_el = wrap;
		wrap.classList.add('dragging');
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			try { e.dataTransfer.setData('text/plain', wrap.id); } catch (err) { /* 일부 브라우저 setData 미지원 무시 */ }
		}
	});

	wrap.addEventListener('dragover', function(e) {
		if (!drag_src_el || drag_src_el === wrap) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

		var rect = wrap.getBoundingClientRect();
		var before = (e.clientX - rect.left) < (rect.width / 2);
		wrap.classList.remove('drag-over-before', 'drag-over-after');
		wrap.classList.add(before ? 'drag-over-before' : 'drag-over-after');
	});

	wrap.addEventListener('dragleave', function() {
		wrap.classList.remove('drag-over-before', 'drag-over-after');
	});

	wrap.addEventListener('drop', function(e) {
		if (!drag_src_el || drag_src_el === wrap) return;
		e.preventDefault();

		var rect = wrap.getBoundingClientRect();
		var before = (e.clientX - rect.left) < (rect.width / 2);
		var list = get_by_id('item-list');
		if (before) list.insertBefore(drag_src_el, wrap);
		else list.insertBefore(drag_src_el, wrap.nextSibling);

		wrap.classList.remove('drag-over-before', 'drag-over-after');
	});

	wrap.addEventListener('dragend', function() {
		wrap.classList.remove('dragging');
		wrap.draggable = false;
		var items = document.querySelectorAll('#item-list .mh_slide_item');
		for (var i = 0; i < items.length; i++) {
			items[i].classList.remove('drag-over-before', 'drag-over-after');
		}
		drag_src_el = null;
	});
}

/* ── 기존에 이 글에 업로드되어 있는 이미지 중에서 골라 추가 ── */
var existing_files = {};
var existing_loaded = false;

function toggleExistingPanel() {
	var panel = get_by_id('existing-panel');
	var showing = (panel.style.display != 'none');
	if (showing) {
		panel.style.display = 'none';
		return;
	}
	panel.style.display = 'block';
	if (!existing_loaded) {
		loadExistingImageList();
	}
}

function loadExistingImageList(onLoaded) {
	var fo = get_by_id("fo");
	var editor_sequence = fo.editor_sequence.value;
	var list_obj = get_by_id("existing_image_select");

	jQuery.exec_json('file.getFileList', {'editor_sequence': editor_sequence}, function(res) {
		existing_loaded = true;
		if (res && res.files) {
			jQuery.each(res.files, function(index, file) {
				var file_srl = file.file_srl;
				if (!file_srl) return;
				var filename = file.source_filename || '';
				if (!/\.(jpe?g|png|gif)$/i.test(filename)) return;

				existing_files[file_srl] = file;
				var opt = new Option(filename, file_srl, false, false);
				list_obj.options.add(opt);
			});
		}
		if (onLoaded) onLoaded();
	});
}

/* ── 이미지 항목(카드)의 data-src를 실제 업로드 파일 목록과 대조해서 file_srl을 알아냄 ──
   (수정 화면에서 이미 저장되어 있던 슬라이드를 복원한 경우, mh_slides에는 file_srl이
   저장되어 있지 않으므로, 에디터의 파일 목록에서 같은 주소를 찾아 연결해준다) */
function linkExistingFileSrls() {
	var src_to_srl = {};
	for (var srl in existing_files) {
		if (!existing_files.hasOwnProperty(srl)) continue;
		var f = existing_files[srl];
		if (!f || !f.download_url) continue;
		src_to_srl[f.download_url.replace(request_uri, '').trim()] = srl;
	}
	var items = document.querySelectorAll('#item-list .mh_slide_item');
	for (var i = 0; i < items.length; i++) {
		var el = items[i];
		if (el.getAttribute('data-file-srl')) continue;
		var src = el.getAttribute('data-src');
		if (src && src_to_srl[src]) {
			el.setAttribute('data-file-srl', src_to_srl[src]);
		}
	}
}

function addSelectedExisting() {
	var list_obj = get_by_id("existing_image_select");
	for (var i = 0; i < list_obj.length; i++) {
		var opt = list_obj.options[i];
		if (!opt.selected) continue;
		var file_obj = existing_files[opt.value];
		if (!file_obj) continue;
		var src = file_obj.download_url.replace(request_uri, '').trim();
		addImageItem({ src: src, caption: '' });
		opt.selected = false;
	}
}

function uploadItemFile(file, wrap, img, thumb, fileInput, reBtn, status, callback) {
	var fo = get_by_id("fo");
	var formData = new FormData();
	formData.append('Filedata', file);
	formData.append('editor_sequence', fo.editor_sequence.value);
	formData.append('module_srl', get_by_id('module_srl').value);
	formData.append('mid', get_by_id('mid').value);

	status.className = 'item-status';
	status.textContent = '업로드 중...';

	jQuery.ajax({
		url: './index.php?module=file&act=procFileUpload',
		type: 'POST',
		data: formData,
		processData: false,
		contentType: false,
		dataType: 'json',
		success: function(data) {
			if (!data || data.error != 0 || !data.download_url) {
				status.className = 'item-status error';
				status.textContent = (data && data.message) ? data.message : '업로드 실패';
				if (callback) callback();
				return;
			}
			var src = data.download_url.replace(request_uri, '');
			// 같은 카드에 이미 업로드되어 있던 파일이 있다면(재업로드로 교체하는 경우), 기존 파일은 에디터에서 정리
			var old_file_srl = wrap.getAttribute('data-file-srl');
			if (old_file_srl && String(old_file_srl) !== String(data.file_srl || '')) {
				deleteEditorFile(old_file_srl);
			}
			wrap.setAttribute('data-src', src);
			if (data.file_srl) wrap.setAttribute('data-file-srl', data.file_srl);
			img.src = src;
			thumb.className = 'item-thumb has-image';
			fileInput.style.display = 'none';
			reBtn.style.display = 'block';
			status.textContent = '';
			if (callback) callback();
		},
		error: function() {
			status.className = 'item-status error';
			status.textContent = '업로드 실패 (서버 오류)';
			if (callback) callback();
		}
	});
}

/* ── 여러 이미지 한 번에 추가 ── */
function handleMultiFileSelect(input) {
	// input.files(FileList)는 input.value를 비우는 순간 무효화되므로, 먼저 배열로 복사해둔다.
	var files = [];
	for (var i = 0; i < input.files.length; i++) {
		files.push(input.files[i]);
	}
	input.value = '';
	if (!files.length) return;

	var cards = [];
	for (var i = 0; i < files.length; i++) {
		var wrap = addImageItem();
		cards.push({
			file: files[i],
			wrap: wrap,
			img: wrap.querySelector('.item-thumb img'),
			thumb: wrap.querySelector('.item-thumb'),
			fileInput: wrap.querySelector('.item-thumb input[type="file"]'),
			reBtn: wrap.querySelector('.btn-reupload'),
			status: wrap.querySelector('.item-status')
		});
	}

	uploadMultiQueue(cards, 0);
}

function uploadMultiQueue(cards, index) {
	if (index >= cards.length) return;
	var c = cards[index];
	uploadItemFile(c.file, c.wrap, c.img, c.thumb, c.fileInput, c.reBtn, c.status, function() {
		uploadMultiQueue(cards, index + 1);
	});
}

function collectImageItems() {
	var result = [];
	var els = document.querySelectorAll('#item-list .mh_slide_item');
	for (var i = 0; i < els.length; i++) {
		var el = els[i];
		var src = el.getAttribute('data-src') || '';
		if (!src) continue;
		var capEl = el.querySelector('.item-caption');
		result.push({ src: src, caption: capEl ? capEl.value : '' });
	}
	return result;
}

function escapeAttr(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function getMhSlide() {
	var node, $node;

	// 부모창이 있는지 체크
	if (typeof(opener) == "undefined") return;

	// 부모 위지윅 에디터에서 선택된 영역이 있으면 처리 (수정 모드)
	node = opener.editorPrevNode;
	$node = jQuery(node);
	if ($node.is('img') && $node.attr('editor_component') == 'mh_slide') {
		selected_node = node;

		var attr_width = $node.attr('mh_width');
		var attr_height = $node.attr('mh_height');
		get_by_id('width').value = (typeof attr_width !== 'undefined') ? attr_width : 800;
		get_by_id('height').value = (typeof attr_height !== 'undefined') ? attr_height : 460;
		get_by_id('auto_play').checked = ($node.attr('auto_play') != 'N');
		get_by_id('random_effect').checked = ($node.attr('random_effect') != 'N');
		get_by_id('ascending_order').checked = ($node.attr('ascending_order') != 'N');
		get_by_id('show_thumbs').checked = ($node.attr('show_thumbs') != 'N');
		get_by_id('duration').value = $node.attr('duration') || 2000;
		get_by_id('speed').value = $node.attr('speed') || 1500;

		var saved_align = $node.attr('mh_align') || 'center';
		var align_radios = document.getElementsByName('align');
		for (var i = 0; i < align_radios.length; i++) {
			align_radios[i].checked = (align_radios[i].value == saved_align);
		}

		var selected_effects = $node.attr('effects') || '';
		if (selected_effects) {
			var effect_arr = selected_effects.split(',');
			var items = document.getElementsByClassName('effect_item');
			for (var i = 0; i < items.length; i++) {
				items[i].checked = (effect_arr.indexOf(items[i].value) != -1);
			}
			syncEffectAllState();
		}

		// 이미지 항목 복원: 새 형식(mh_slides, JSON) 우선, 없으면 예전 형식(images_list) 순서로
		var restored = false;
		var saved_slides_json = $node.attr('mh_slides');
		if (saved_slides_json) {
			try {
				var arr = JSON.parse(saved_slides_json);
				if (arr && arr.length) {
					for (var i = 0; i < arr.length; i++) {
						addImageItem({ src: arr[i].src, caption: arr[i].caption || '' });
					}
					restored = true;
				}
			} catch (e) { /* ignore parse error, fall back below */ }
		}
		if (!restored) {
			var legacy = $node.attr('images_list') || '';
			if (legacy) {
				var legacy_arr = legacy.split(' ');
				for (var i = 0; i < legacy_arr.length; i++) {
					var src = legacy_arr[i].trim();
					if (src) addImageItem({ src: src, caption: '' });
				}
			}
		}
	}
}

function insertMhSlide() {
	if (typeof(opener) == "undefined") return;

	var slides = collectImageItems();
	if (!slides.length) {
		alert('이미지를 한 장 이상 업로드해주세요.');
		return;
	}

	var effect_list = "";
	var items = document.getElementsByClassName('effect_item');
	for (var i = 0; i < items.length; i++) {
		if (items[i].checked) effect_list += items[i].value + ",";
	}
	effect_list = effect_list.replace(/,$/, '');

	var width = get_by_id("width").value.trim();
	var height = get_by_id("height").value.trim();
	var is_full_width = (!width && !height);
	var auto_play = get_by_id("auto_play").checked ? "Y" : "N";
	var random_effect = get_by_id("random_effect").checked ? "Y" : "N";
	var ascending_order = get_by_id("ascending_order").checked ? "Y" : "N";
	var show_thumbs = get_by_id("show_thumbs").checked ? "Y" : "N";
	var duration = get_by_id("duration").value || 2000;
	var speed = get_by_id("speed").value || 1500;

	var checkedAlign = document.querySelector('input[name="align"]:checked');
	var align = checkedAlign ? checkedAlign.value : 'center';

	var align_style = "";
	if (align == "center") align_style = "margin-left:auto;margin-right:auto;";
	else if (align == "right") align_style = "margin-left:auto;margin-right:0;";
	else align_style = "margin-left:0;margin-right:auto;";

	var slides_json = JSON.stringify(slides);

	// 에디터 작성화면 미리보기 박스 크기(실제 저장되는 mh_width/mh_height 속성과는 별개, 화면표시용 추정치)
	var preview_width = parseInt(width, 10) || 0;
	var preview_height = parseInt(height, 10) || 0;
	if (!preview_width && preview_height) preview_width = Math.round(preview_height * 1.6);
	if (!preview_height && preview_width) preview_height = Math.round(preview_width * 0.6);
	if (!preview_width) preview_width = 800;
	if (!preview_height) preview_height = 460;

	if (selected_node) {
		selected_node.setAttribute("mh_width", width);
		selected_node.setAttribute("mh_height", height);
		selected_node.setAttribute("auto_play", auto_play);
		selected_node.setAttribute("random_effect", random_effect);
		selected_node.setAttribute("ascending_order", ascending_order);
		selected_node.setAttribute("show_thumbs", show_thumbs);
		selected_node.setAttribute("duration", duration);
		selected_node.setAttribute("speed", speed);
		selected_node.setAttribute("effects", effect_list);
		selected_node.setAttribute("mh_slides", slides_json);
		selected_node.removeAttribute("images_list");
		selected_node.setAttribute("mh_align", align);
		selected_node.setAttribute("src", slides[0].src);
		if (is_full_width) {
			selected_node.style.width = "100%";
		} else {
			selected_node.style.width = preview_width + "px";
		}
		selected_node.style.height = preview_height + "px";
		selected_node.style.display = "block";
		selected_node.style.marginLeft = (align == "left") ? "0" : "auto";
		selected_node.style.marginRight = (align == "right") ? "0" : "auto";
	} else {
		// 글 작성 화면(에디터 iframe)에서는 transHTML() 변환이 실행되지 않고 태그가 그대로 보인다.
		// 첫 번째로 선택한 이미지를 실제 src로 사용해서, 에디터 안에서도 어떤 슬라이드인지 바로 보이게 한다.
		var preview_src = slides[0].src;
		var preview_width_style = is_full_width ? "100%" : (preview_width + "px");
		var text = "<img src=\"" + preview_src + "\" editor_component=\"mh_slide\""
			+ " mh_width=\"" + width + "\" mh_height=\"" + height + "\""
			+ " auto_play=\"" + auto_play + "\" random_effect=\"" + random_effect + "\" ascending_order=\"" + ascending_order + "\" show_thumbs=\"" + show_thumbs + "\""
			+ " duration=\"" + duration + "\" speed=\"" + speed + "\" effects=\"" + effect_list + "\""
			+ " mh_slides=\"" + escapeAttr(slides_json) + "\" mh_align=\"" + align + "\""
			+ " style=\"display:block;width:" + preview_width_style + ";height:" + preview_height + "px;border:2px dotted #4371B9;"
			+ align_style + "object-fit:cover;\" />";
		opener.editorFocus(opener.editorPrevSrl);
		var iframe_obj = opener.editorGetIFrame(opener.editorPrevSrl);
		opener.editorReplaceHTML(iframe_obj, text);
	}

	opener.editorFocus(opener.editorPrevSrl);

	window.close();
}

jQuery(function($) {
	getMhSlide();
	loadExistingImageList(linkExistingFileSrls);

	$(document).on('change', '.effect_item', syncEffectAllState);
});
