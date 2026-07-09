<?php
/**
 * @class  mh_slide
 * @author 팔공산 (80san@moonhouse.co.kr)
 * @brief  업로드한 이미지로 다양한 전환효과를 가진 슬라이드쇼를 생성하는 에디터 컴포넌트
 */
class mh_slide extends EditorHandler
{
	var $editor_sequence = 0;
	var $component_path = '';

	/**
	 * @brief 사용 가능한 전환효과 화이트리스트 (임의 값 주입 방지)
	 */
	var $allowed_effects = array(
		'fade', 'fadeLeft', 'fadeRight', 'fadeTop', 'fadeBottom', 'fadeTopLeft', 'fadeBottomRight',
		'blindsLeft', 'blindsRight', 'blindsTop', 'blindsBottom', 'blindsTopLeft', 'blindsBottomRight',
		'curtainLeft', 'curtainRight', 'interlaceLeft', 'interlaceRight', 'mosaic', 'bomb', 'fumes'
	);

	function __construct($editor_sequence, $component_path)
	{
		$this->editor_sequence = $editor_sequence;
		$this->component_path = $component_path;
	}

	/**
	 * @brief 팝업창에 표시할 설정 화면
	 */
	function getPopupContent()
	{
		$tpl_path = $this->component_path.'tpl';
		$tpl_file = 'popup.html';

		Context::set("tpl_path", $tpl_path);

		$oTemplate = TemplateHandler::getInstance();
		return $oTemplate->compile($tpl_path, $tpl_file);
	}

	/**
	 * @brief 에디터에 삽입된 placeholder <img> 태그를 실제 슬라이드 HTML로 변환
	 */
	function transHTML($xml_obj)
	{
		$slide_info = new stdClass();
		$slide_info->srl = rand(111111, 999999);

		$slide_info->auto_play_js = ($xml_obj->attrs->auto_play === 'N') ? 'false' : 'true';
		$slide_info->show_thumbs = ($xml_obj->attrs->show_thumbs === 'N') ? false : true;
		$slide_info->random_effect_js = ($xml_obj->attrs->random_effect === 'N') ? 'false' : 'true';
		$slide_info->ascending_order_js = ($xml_obj->attrs->ascending_order === 'N') ? 'false' : 'true';

		$slide_info->duration = (int)$xml_obj->attrs->duration;
		if (!$slide_info->duration) $slide_info->duration = 2000;

		$slide_info->speed = (int)$xml_obj->attrs->speed;
		if (!$slide_info->speed) $slide_info->speed = 1500;

		$align = (string)$xml_obj->attrs->mh_align;
		if (!in_array($align, array('left', 'center', 'right'))) $align = 'center';
		$slide_info->align = $align;
		if ($align === 'left') {
			$slide_info->margin_style = 'margin-left:0 !important;margin-right:auto !important;';
		} elseif ($align === 'right') {
			$slide_info->margin_style = 'margin-left:auto !important;margin-right:0 !important;';
		} else {
			$slide_info->margin_style = 'margin-left:auto !important;margin-right:auto !important;';
		}

		$effects_list = explode(',', trim($xml_obj->attrs->effects));
		$effects_list = array_intersect($effects_list, $this->allowed_effects);
		if (!count($effects_list)) $effects_list = array('fade');
		$slide_info->effects_js = implode(',', array_map(function($e) {
			return "'".$e."'";
		}, $effects_list));

		// 이미지+캡션 목록 파싱: 새 형식(mh_slides, JSON) 우선, 없으면 예전 형식(images_list)으로 하위 호환
		$slides = array();
		$slides_json = (string)$xml_obj->attrs->mh_slides;
		if ($slides_json !== '')
		{
			// 저장 과정에서 큰따옴표가 &quot; 같은 HTML 엔티티로 남아있는 경우가 있어 디코딩 후 파싱
			$slides_json = html_entity_decode($slides_json, ENT_QUOTES, 'UTF-8');
			$decoded = json_decode($slides_json, true);
			if (is_array($decoded))
			{
				foreach ($decoded as $item)
				{
					$src = isset($item['src']) ? (string)$item['src'] : '';
					$caption = isset($item['caption']) ? (string)$item['caption'] : '';
					if (preg_match('/^[a-z0-9\/_\-.]+\.(gif|jpe?g|png)$/i', $src))
					{
						$slide_item = new stdClass();
						$slide_item->src = $src;
						$slide_item->caption = $caption;
						$slide_item->caption_html = nl2br(htmlspecialchars($caption, ENT_QUOTES, 'UTF-8'));
						$slides[] = $slide_item;
					}
				}
			}
		}
		if (!count($slides))
		{
			// 예전 방식(공백으로 구분된 images_list, 캡션 없음) - image_gallery 컴포넌트와 동일한 파싱 방식
			$images_list = $xml_obj->attrs->images_list;
			$images_list = trim(preg_replace('/\.(gif|jpe?g|png) /i', ".\\1\n", $images_list));
			$images_list = explode("\n", trim($images_list));
			$images_list = preg_grep("/^[a-z0-9\/_\-.]+\.(gif|jpe?g|png)+$/i", $images_list);
			foreach ($images_list as $src)
			{
				$slide_item = new stdClass();
				$slide_item->src = $src;
				$slide_item->caption = '';
				$slide_item->caption_html = '';
				$slides[] = $slide_item;
			}
		}
		$slide_info->slides = $slides;

		// XMLRPC(모바일 앱 등) 요청 시 이미지 태그만 단순 출력
		if (Context::getResponseMethod() == 'XMLRPC')
		{
			$output = array();
			foreach ($slide_info->slides as $idx => $slide)
			{
				$output[] = sprintf('<img src="%s" alt="Slide image no.%d" />', $slide->src, $idx + 1);
			}
			return implode('<br />', $output);
		}

		// 가로/세로 크기 계산: 둘 다 입력되어 있으면 그 크기 그대로(늘려서 채움),
		// 하나만 입력되어 있으면 실제 이미지 비율로 나머지 값을 자동 계산(찌그러짐 없이 표시)
		$raw_width = trim((string)$xml_obj->attrs->mh_width);
		$raw_height = trim((string)$xml_obj->attrs->mh_height);
		$given_width = ($raw_width !== '' && (int)$raw_width > 0) ? (int)$raw_width : null;
		$given_height = ($raw_height !== '' && (int)$raw_height > 0) ? (int)$raw_height : null;

		if ($given_width === null && $given_height === null)
		{
			// 아무 것도 입력 안 되어 있으면 기존 기본값
			$given_width = 800;
			$given_height = 460;
		}

		if ($given_width !== null && $given_height === null)
		{
			// 가로만 지정 → 세로는 실제 이미지 비율대로 자동 계산 (가장 큰 값 기준)
			$max_height = 0;
			foreach ($slide_info->slides as $slide)
			{
				$size = $this->_getImageSize($slide->src);
				$calc_height = $size ? round($size[1] * ($given_width / $size[0])) : round($given_width * 0.6);
				if ($calc_height > $max_height) $max_height = $calc_height;
			}
			$slide_info->width = $given_width;
			$slide_info->height = $max_height ? $max_height : round($given_width * 0.6);
			$slide_info->object_fit = 'contain';
		}
		elseif ($given_height !== null && $given_width === null)
		{
			// 세로만 지정 → 가로는 실제 이미지 비율대로 자동 계산 (가장 큰 값 기준)
			$max_width = 0;
			foreach ($slide_info->slides as $slide)
			{
				$size = $this->_getImageSize($slide->src);
				$calc_width = $size ? round($size[0] * ($given_height / $size[1])) : round($given_height * 1.6);
				if ($calc_width > $max_width) $max_width = $calc_width;
			}
			$slide_info->width = $max_width ? $max_width : round($given_height * 1.6);
			$slide_info->height = $given_height;
			$slide_info->object_fit = 'contain';
		}
		else
		{
			// 가로/세로 둘 다 지정 → 예전과 동일하게 지정한 크기로 채움
			$slide_info->width = $given_width;
			$slide_info->height = $given_height;
			$slide_info->object_fit = 'fill';
		}
		$slide_info->contain_mode_js = ($slide_info->object_fit === 'contain') ? 'true' : 'false';

		Context::set('slide_info', $slide_info);

		$tpl_path = $this->component_path.'tpl';
		Context::set("tpl_path", $tpl_path);
		$tpl_file = 'display.html';

		$oTemplate = TemplateHandler::getInstance();
		return $oTemplate->compile($tpl_path, $tpl_file);
	}

	/**
	 * @brief 이미지 파일의 실제 가로/세로 픽셀 크기를 반환 (실패 시 null)
	 */
	function _getImageSize($src)
	{
		static $cache = array();
		if (array_key_exists($src, $cache)) return $cache[$src];

		$path = ltrim($src, '/');
		$size = null;
		if (is_readable($path))
		{
			$info = @getimagesize($path);
			if ($info && $info[0] > 0 && $info[1] > 0)
			{
				$size = array($info[0], $info[1]);
			}
		}
		$cache[$src] = $size;
		return $size;
	}
}
/* End of file mh_slide.class.php */
/* Location: ./modules/editor/components/mh_slide/mh_slide.class.php */
