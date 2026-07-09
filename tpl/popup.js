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
	if (preset.src) wrap.setAttribute('data-src', preset.src);

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

	wrap.appendChild(btnDel);
	wrap.appendChild(thumb);
	wrap.appendChild(status);
	wrap.appendChild(caption);

	get_by_id('item-list').appendChild(wrap);

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
	if (el) el.parentNode.removeChild(el);
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

function loadExistingImageList() {
	var fo = get_by_id("fo");
	var editor_sequence = fo.editor_sequence.value;
	var list_obj = get_by_id("existing_image_select");

	jQuery.exec_json('file.getFileList', {'editor_sequence': editor_sequence}, function(res) {
		existing_loaded = true;
		if (!res || !res.files) return;
		jQuery.each(res.files, function(index, file) {
			var file_srl = file.file_srl;
			if (!file_srl) return;
			var filename = file.source_filename || '';
			if (!/\.(jpe?g|png|gif)$/i.test(filename)) return;

			existing_files[file_srl] = file;
			var opt = new Option(filename, file_srl, false, false);
			list_obj.options.add(opt);
		});
	});
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

function uploadItemFile(file, wrap, img, thumb, fileInput, reBtn, status) {
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
				return;
			}
			var src = data.download_url.replace(request_uri, '');
			wrap.setAttribute('data-src', src);
			img.src = src;
			thumb.className = 'item-thumb has-image';
			fileInput.style.display = 'none';
			reBtn.style.display = 'block';
			status.textContent = '';
		},
		error: function() {
			status.className = 'item-status error';
			status.textContent = '업로드 실패 (서버 오류)';
		}
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

		get_by_id('width').value = $node.attr('mh_width') || 800;
		get_by_id('height').value = $node.attr('mh_height') || 460;
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
	if (!effect_list) effect_list = "fade";

	var width = get_by_id("width").value || 800;
	var height = get_by_id("height").value || 460;
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
		selected_node.style.width = width + "px";
		selected_node.style.height = height + "px";
		selected_node.style.display = "block";
		selected_node.style.marginLeft = (align == "left") ? "0" : "auto";
		selected_node.style.marginRight = (align == "right") ? "0" : "auto";
	} else {
		// 글 작성 화면(에디터 iframe)에서는 transHTML() 변환이 실행되지 않고 태그가 그대로 보인다.
		// 첫 번째로 선택한 이미지를 실제 src로 사용해서, 에디터 안에서도 어떤 슬라이드인지 바로 보이게 한다.
		var preview_src = slides[0].src;
		var text = "<img src=\"" + preview_src + "\" editor_component=\"mh_slide\""
			+ " mh_width=\"" + width + "\" mh_height=\"" + height + "\""
			+ " auto_play=\"" + auto_play + "\" random_effect=\"" + random_effect + "\" ascending_order=\"" + ascending_order + "\" show_thumbs=\"" + show_thumbs + "\""
			+ " duration=\"" + duration + "\" speed=\"" + speed + "\" effects=\"" + effect_list + "\""
			+ " mh_slides=\"" + escapeAttr(slides_json) + "\" mh_align=\"" + align + "\""
			+ " style=\"display:block;width:" + width + "px;height:" + height + "px;border:2px dotted #4371B9;"
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

	// 항목이 하나도 없으면(신규 작성) 빈 항목 1개를 기본으로 보여줌
	if (!get_by_id('item-list').children.length) {
		addImageItem();
	}

	$(document).on('change', '.effect_item', syncEffectAllState);
});
