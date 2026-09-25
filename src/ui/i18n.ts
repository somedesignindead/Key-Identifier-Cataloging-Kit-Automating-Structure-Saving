export type UiLanguage =
  | 'ru'
  | 'en';


const CYRILLIC =
  /[А-Яа-яЁё]/;


function normalize(
  value: string,
): string {
  return value
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}


const RU_EN_SOURCE:
  Record<string, string> = {

  /* HEADER */

  'Оптимизатор Хранения, Управления, Единого Наименования и Направленного Отслеживания':
    'Storage, Management, Unified Naming and Directed Tracking Optimizer',

  'Разделы':
    'Sections',

  'Экспорт':
    'Export',

  'Слои':
    'Layers',

  'Переименование':
    'Renaming',

  'Текст':
    'Text',

  'Изображения':
    'Images',

  'Язык интерфейса':
    'Interface language',


  /* EXPORT */

  'Формат':
    'Format',

  'Формат на выходе:':
    'Output format:',

  'Цвет':
    'Color',

  'Цветовая палитра':
    'Color mode',

  'Преобразовать текст в кривые':
    'Convert text to outlines',

  'Перевести текст в кривые':
    'Convert text to outlines',

  'Для типографии':
    'Print production',

  'Слой резки':
    'Cut layer',

  'Имя слоя резки':
    'Cut layer name',

  'Имя spot color':
    'Spot color name',

  'Толщина линии':
    'Stroke width',

  'Толщина линии резки':
    'Cut line width',

  'Уменьшить вес картинок':
    'Reduce image file size',

  'Преобразовать картинки под фактический размер':
    'Reduce images to actual size',

  'Размер по фрейму (px = мм)':
    'Frame size (px = mm)',

  'Финальный размер берём из размеров фрейма (px = mm)':
    'Use frame dimensions as final size (px = mm)',

  'Ш×В (мм)':
    'W×H (mm)',

  'Задать размер':
    'Set size',

  'Ширина':
    'Width',

  'Высота':
    'Height',

  'Финальная ширина':
    'Final width',

  'Финальная высота':
    'Final height',

  'Сохранять пропорции':
    'Keep proportions',

  'Масштаб':
    'Scale',

  'Добавить масштаб ×':
    'Apply scale ×',

  'Масштаб экспорта':
    'Export scale',

  'Минимум растра':
    'Minimum raster resolution',

  'Минимальное разрешение растра':
    'Minimum raster resolution',

  'ICC-профиль CMYK':
    'CMYK ICC profile',

  'Файл ICC-профиля':
    'ICC profile file',

  'Добавить':
    'Add',

  '+ Добавить…':
    '+ Add…',

  'Базовый':
    'Default',

  'Типография…':
    'Print shop…',

  'Для печати используйте профиль, который дала типография.':
    'For print, use the ICC profile supplied by the print shop.',

  'Локальный конвертер':
    'Local converter',

  'Переустановить':
    'Reinstall',

  'Удалить':
    'Remove',

  'Переустановить локальный конвертер':
    'Reinstall local converter',

  'Удалить локальный конвертер':
    'Remove local converter',

  'Экспортировать':
    'Export',

  'Закрыть':
    'Close',

  'Готовые файлы':
    'Exported files',

  'Готовые файлы:':
    'Exported files:',

  'Очистить':
    'Clear',

  'Файлы появляются здесь по мере экспорта.':
    'Files appear here as they are exported.',

  'Пока ничего не экспортировано':
    'Nothing has been exported yet.',

  'Ничего не выбрано':
    'Nothing selected',


  /* TEXT */

  'Замена текста':
    'Text replacement',

  'Поиск и замена':
    'Find and replace',

  'Область':
    'Scope',

  'Выделение':
    'Selection',

  'Текущая страница':
    'Current page',

  'Весь документ':
    'Entire document',

  'Найти':
    'Find',

  'Заменить':
    'Replace',

  'Заменить на':
    'Replace with',

  'Вставить:':
    'Insert:',

  'Перенос строки':
    'Line break',

  'Табуляция':
    'Tab',

  'Учитывать регистр':
    'Case sensitive',

  'Только целое слово':
    'Whole word only',

  'Целое слово':
    'Whole word',

  'Весь текст слоя':
    'Entire layer text',

  'Всё содержимое слоя должно совпасть':
    'Match the entire layer text',

  'Скрытые слои':
    'Hidden layers',

  'Включая скрытые слои':
    'Include hidden layers',

  'Фильтр слоёв':
    'Layer filter',

  'Фильтр по имени текстового слоя':
    'Text layer name filter',

  'Имя содержит':
    'Name contains',

  'Имя не содержит':
    'Name does not contain',

  'Например Title':
    'e.g. Title',

  'Символ ↵ означает перенос строки, ⇥ — табуляцию.':
    '↵ means a line break, ⇥ means a tab.',

  'Введите текст для поиска.':
    'Enter text to find.',

  'Заменить текст':
    'Replace text',


  /* RENAME */

  'Переименование слоёв':
    'Rename layers',

  'Способ переименования':
    'Renaming method',

  'Режим':
    'Mode',

  'Включая вложенные':
    'Include nested layers',

  'Включая вложенные слои':
    'Include nested layers',

  'Найти → заменить':
    'Find → Replace',

  'Префикс / суффикс':
    'Prefix / suffix',

  'Задать имя полностью':
    'Set full name',

  'Нумерация':
    'Numbering',

  'Шаблон':
    'Template',

  'По дочернему слою':
    'From child layer',

  'По содержимому дочернего слоя':
    'From child layer content',

  'Например Rectangle':
    'e.g. Rectangle',

  'Префикс':
    'Prefix',

  'Суффикс':
    'Suffix',

  'Новое имя':
    'New name',

  'Основа':
    'Base',

  'Основа имени':
    'Name base',

  'Начальное число':
    'Starting number',

  'Количество цифр':
    'Number of digits',

  'Например: Layer 01, Layer 02, Layer 03.':
    'Example: Layer 01, Layer 02, Layer 03.',

  'Доступно: {name}, {index}, {width}, {height}, {type}':
    'Available: {name}, {index}, {width}, {height}, {type}',

  'Имя из дочернего слоя':
    'Name from child layer',

  'Источник имени':
    'Name source',

  'Где искать':
    'Search depth',

  'Первый уровень':
    'First level',

  'Только первый уровень':
    'First level only',

  'Любая глубина':
    'Any depth',

  'На любой глубине':
    'Any depth',

  'Если не найден':
    'If not found',

  'Пропустить':
    'Skip',

  'Пропустить слой':
    'Skip layer',

  'Оставить имя':
    'Keep name',

  'Оставить текущее имя':
    'Keep current name',

  'Папка из слоя':
    'Folder from layer',

  'Добавить папку из слоя':
    'Add folder from layer',

  'Источник папки':
    'Folder source',

  'Финальная обработка':
    'Final processing',

  'Финальная обработка имени':
    'Final name processing',

  'Обрезать края':
    'Trim edges',

  'Обрезать пробелы по краям':
    'Trim surrounding spaces',

  'Схлопнуть пробелы':
    'Collapse spaces',

  'Схлопнуть повторные пробелы':
    'Collapse repeated spaces',

  'Пробелы':
    'Spaces',

  'Оставить':
    'Keep',

  'Заменить на -':
    'Replace with -',

  'Заменить на _':
    'Replace with _',

  'Слеш /':
    'Slash /',

  'Иерархия':
    'Keep hierarchy',

  'Оставить иерархию':
    'Keep hierarchy',

  'Удалить символы':
    'Remove characters',

  'Например: ,.;':
    'e.g. ,.;',

  'Регистр':
    'Case',

  'Не менять':
    'Keep unchanged',

  'Финальный префикс':
    'Final prefix',

  'Финальный суффикс':
    'Final suffix',

  'Предпросмотр':
    'Preview',

  'Измените параметры — здесь появится предпросмотр.':
    'Change the settings to see a preview here.',

  'Переименовать':
    'Rename',


  /* IMAGES */

  'Режим изображения':
    'Image mode',

  'Не менять режим':
    'Keep current mode',

  'Fit · вписать':
    'Fit · contain',

  'Fill · заполнить':
    'Fill · cover',

  'Crop · кадрировать':
    'Crop',

  'Tile · плитка':
    'Tile',

  'Contain · Fit':
    'Contain · Fit',

  'Cover · Fill':
    'Cover · Fill',

  'Искать внутри фреймов':
    'Search inside frames',

  'Включая IMAGE-заливки внутри выделенных фреймов':
    'Include IMAGE fills inside selected frames',

  'Позиционирование':
    'Positioning',

  'Позиция Cover / Crop':
    'Cover / Crop position',

  'Позиция изображения':
    'Image position',

  'Размер bitmap':
    'Bitmap size',

  'Фактический размер bitmap':
    'Actual bitmap size',

  'Уменьшить исходник':
    'Reduce source bitmap',

  'Подогнать реальный размер под фактический':
    'Reduce bitmap to actual display size',

  'Плотность':
    'Density',

  'Только уменьшение. Картинки никогда не увеличиваются. TILE при оптимизации пропускается.':
    'Downscaling only. Images are never enlarged. TILE fills are skipped.',

  'Выберите слой с IMAGE-заливкой.':
    'Select a layer with an IMAGE fill.',

  'Применить':
    'Apply',

  'Применить к изображениям':
    'Apply to images',


  /* MODALS */

  'Удаление локального конвертера':
    'Remove local converter',

  'Из Figma нельзя безопасно удалить системные файлы Helper, поэтому удаление выполняется вручную.':
    'Figma cannot safely remove Helper system files, so removal must be performed manually.',

  'Откройте Terminal и выполните:':
    'Open Terminal and run:',

  'Если Helper установлен через установщик:':
    'If Helper was installed using the installer:',

  'Для portable-версии удалите папку':
    'For the portable version, delete the folder',

  'Установка Layer Export Helper':
    'Install Layer Export Helper',

  'Зачем он нужен?':
    'Why is it needed?',

  'Figma работает в изолированной среде и сама не умеет выполнять часть полиграфических операций, которые нужны этому плагину: преобразование в CMYK по ICC-профилю, сохранение редактируемого текста в PDF, Spot Color, Overprint и подготовку слоя резки.':
    'Figma runs in a sandbox and cannot perform several print-production operations required by this plugin: ICC-based CMYK conversion, editable text in PDF, Spot Color, Overprint, and cut-layer preparation.',

  'Layer Export Helper — небольшой локальный компонент на вашем компьютере. Он запускает конвертер только когда нужен экспорт. Файлы передаются между Figma и Helper локально через localhost и не отправляются на сторонний сервер.':
    'Layer Export Helper is a small local component on your computer. It starts the converter only when export requires it. Files are transferred locally between Figma and Helper through localhost and are not sent to a third-party server.',

  'Нажмите «Скачать ZIP».':
    'Click “Download ZIP”.',

  'Распакуйте архив.':
    'Extract the archive.',

  'Запустите Layer Export Helper.':
    'Launch Layer Export Helper.',

  'Если macOS блокирует первый запуск — нажмите правой кнопкой по приложению → «Открыть».':
    'If macOS blocks the first launch, right-click the application and choose “Open”.',

  'Вернитесь в Figma. Экспорт продолжится автоматически.':
    'Return to Figma. Export will continue automatically.',

  'Запустите Layer Export Helper.exe или установщик из архива.':
    'Run Layer Export Helper.exe or the installer from the archive.',

  'Разрешите запуск, если Windows покажет системное предупреждение.':
    'Allow the application to run if Windows displays a system warning.',

  'Helper требуется установить только один раз. После этого плагин будет запускать локальный конвертер автоматически.':
    'Helper only needs to be installed once. After that, the plugin will start the local converter automatically.',

  'Отмена':
    'Cancel',

  'Скачать ZIP':
    'Download ZIP',

  'Скачать Setup.exe':
    'Download Setup.exe',

  'Скачать заново':
    'Download again',


  /* APPROVED TOOLTIPS — EXPORT */

  'Преобразует текстовые объекты в векторные контуры перед экспортом. Внешний вид сохраняется, но текст больше нельзя будет редактировать как текст. Полезно для передачи файлов в типографию на печать – так шрифты не слетят':
    'Converts text objects to vector outlines before export. The appearance is preserved, but the text can no longer be edited as text. Useful when sending files to a print shop so fonts cannot be substituted or lost.',

  'Имя слоя Figma, содержащего контур резки. При экспорте он будет вынесен отдельно для плоттера или типографии.':
    'The name of the Figma layer containing the cut contour. During export it is separated for a cutting plotter or print shop.',

  'Имя плашечного цвета, назначаемого контуру резки. Обычно типографии используют CutContour.':
    'The spot color name assigned to the cut contour. Print shops commonly use CutContour.',

  'Включает наложение краски для контура резки. CutContour не будет вырезать под собой фон при печати.':
    'Enables overprint for the cut contour. CutContour will not knock out the artwork underneath when printed.',

  'Толщина контура резки в итоговом PDF, в пунктах. Обычно достаточно 0,25 pt.':
    'Cut contour stroke width in the final PDF, in points. 0.25 pt is usually sufficient.',

  'Уменьшает слишком большие растровые изображения до размера, достаточного для макета. Оригинальные изображения и объекты в Figma не изменяются. Примените, если экспорт идет долго или упирается в лимит 100мб.':
    'Reduces oversized raster images to a resolution sufficient for the layout. Original images and Figma objects are not modified. Use this if export is slow or reaches the 100 MB limit.',

  'Физический размер PDF берётся из размера фрейма: 1 px в Figma = 1 мм в итоговом файле.':
    'The physical PDF size is taken from the frame dimensions: 1 px in Figma = 1 mm in the final file.',

  'Позволяет вручную задать физическую ширину и высоту итогового PDF в миллиметрах.':
    'Lets you manually set the physical width and height of the final PDF in millimeters.',

  'Дополнительный множитель итогового физического размера. Можно выбрать 0,5 / 1 / 2 / 3 или ввести своё значение.':
    'An additional multiplier for the final physical size. Choose 0.5 / 1 / 2 / 3 or enter a custom value.',

  'Цветовой профиль для преобразования в CMYK. Можно выбрать ранее добавленный профиль или загрузить новый ICC/ICM-файл типографии.':
    'Color profile used for CMYK conversion. Select a previously added profile or load a new ICC/ICM profile supplied by the print shop.',

  'Загрузите CMYK ICC/ICM-профиль. Добавленный профиль сохранится и будет доступен при следующих запусках плагина.':
    'Load a CMYK ICC/ICM profile. The added profile is saved and remains available in future plugin sessions.',

  'Переустанавливает или обновляет локальный Layer Export Helper.':
    'Reinstalls or updates the local Layer Export Helper.',

  'Показывает инструкцию по удалению Layer Export Helper с компьютера.':
    'Shows instructions for removing Layer Export Helper from the computer.',


  /* APPROVED TOOLTIPS — TEXT */

  'Поиск и массовая замена текста. По умолчанию изменения применяются только внутри текущего выделения.':
    'Find and replace text in bulk. By default, changes are applied only inside the current selection.',

  'Выделение — только выбранные объекты. Текущая страница — все подходящие слои на странице. Весь документ — поиск по всем страницам файла.':
    'Selection — selected objects only. Current page — all matching layers on the current page. Entire document — search all pages in the file.',

  'Текст, который нужно найти. Можно использовать ↵ для переноса строки и ⇥ для табуляции.':
    'Text to find. Use ↵ for a line break and ⇥ for a tab.',

  'Новый текст. Оставьте поле пустым, если найденный текст нужно удалить. Поддерживаются ↵ и ⇥.':
    'Replacement text. Leave this field empty to delete the matched text. ↵ and ⇥ are supported.',

  'Если включено, ABC и abc считаются разными строками.':
    'When enabled, ABC and abc are treated as different strings.',

  'Совпадение должно быть отдельным словом, а не частью другого слова.':
    'The match must be a complete word rather than part of another word.',

  'Использует регулярные выражения вместо обычного поиска. Примеры: \\d+ — любое число, \\s+ — пробелы, .* — любой текст, (...) — группа захвата. В поле замены можно использовать $1, $2 и далее для групп, $& — всё найденное совпадение, $<name> — именованную группу.':
    'Uses regular expressions instead of plain-text search. Examples: \\d+ — any number, \\s+ — whitespace, .* — any text, (...) — a capture group. In Replace you can use $1, $2, etc. for capture groups, $& for the full match, and $<name> for a named group.',

  'Слой будет изменён только если он целиком состоит из поискового запроса. Например, при поиске «Хуй» слой «Хуй» изменится, а слой «Хуй моржовый» — нет.':
    'The layer is changed only when its entire text matches the search query. For example, searching for “Foo” changes a layer containing only “Foo”, but not a layer containing “Foo bar”.',

  'Включает в поиск скрытые текстовые слои.':
    'Includes hidden text layers in the search.',

  'Группа настроек, которая ограничивает, в каких текстовых слоях выполнять поиск. Фильтрация идёт по имени слоя, а не по тексту внутри него.':
    'A group of settings that limits which text layers are searched. Filtering uses the layer name, not the text inside the layer.',

  'Искать текст только в слоях, имя которых содержит указанную строку. Например, значение Title подойдёт для Title, Product Title и TITLE. Регистр имени не учитывается.':
    'Search only layers whose name contains the specified string. For example, Title matches Title, Product Title, and TITLE. Layer-name matching is case-insensitive.',

  'Не искать текст в слоях, имя которых содержит указанную строку. Например, значение Button исключит Button, Main Button и BUTTON. Регистр имени не учитывается.':
    'Exclude layers whose name contains the specified string. For example, Button excludes Button, Main Button, and BUTTON. Layer-name matching is case-insensitive.',


  /* APPROVED TOOLTIPS — RENAME */

  'Массовое переименование выбранных объектов. Перед применением результат можно проверить в предпросмотре.':
    'Bulk rename selected objects. Review the result in Preview before applying it.',

  'Определяет, как будет сформировано новое имя: замена текста, префикс/суффикс, полное имя, нумерация, шаблон или значение дочернего слоя.':
    'Defines how the new name is created: text replacement, prefix/suffix, full name, numbering, template, or a value from a child layer.',

  'Применяет переименование не только к выбранным объектам, но и к их дочерним слоям.':
    'Applies renaming not only to selected objects but also to their child layers.',

  'Находит указанную часть текущего имени слоя и заменяет её новым значением.':
    'Finds the specified part of the current layer name and replaces it with a new value.',

  'Использует регулярное выражение вместо обычного поиска по имени слоя. Примеры: \\d+ — любое число, .* — любой текст, ^icon- — имя начинается с icon-, -old$ — имя заканчивается на -old. Группы можно использовать для поиска сложных шаблонов.':
    'Uses a regular expression instead of plain-text layer-name search. Examples: \\d+ — any number, .* — any text, ^icon- — name starts with icon-, -old$ — name ends with -old. Capture groups can be used for more complex patterns.',

  'Если включено, Rectangle и rectangle считаются разными именами.':
    'When enabled, Rectangle and rectangle are treated as different names.',

  'Добавляет указанный текст перед текущим именем слоя.':
    'Adds the specified text before the current layer name.',

  'Добавляет указанный текст после текущего имени слоя.':
    'Adds the specified text after the current layer name.',

  'Полностью заменяет текущее имя слоя указанным значением.':
    'Completely replaces the current layer name with the specified value.',

  'Формирует имена из общей основы и последовательного номера.':
    'Creates names from a common base and a sequential number.',

  'Первое число последовательности.':
    'The first number in the sequence.',

  'Количество цифр в номере. Например, 2 превращает 1 в 01.':
    'Number of digits in the sequence number. For example, 2 turns 1 into 01.',

  'Создаёт имя по шаблону. Доступны переменные {name}, {index}, {width}, {height} и {type}.':
    'Creates a name from a template. Available variables: {name}, {index}, {width}, {height}, and {type}.',

  'Ищет внутри объекта слой с заданным именем. Для TEXT берётся его текст, для других типов — имя найденного слоя.':
    'Searches inside the object for a layer with the specified name. For TEXT layers, its text is used; for other types, the found layer name is used.',

  'Имя дочернего слоя, значение которого будет использовано как новое имя родительского объекта.':
    'Name of the child layer whose value will be used as the new name of the parent object.',

  'Первый уровень ищет только среди непосредственных дочерних слоёв. Любая глубина ищет во всём дереве объекта.':
    'First level searches only direct child layers. Any depth searches the entire object tree.',

  'Определяет поведение, если нужный дочерний слой отсутствует: пропустить объект или оставить текущее имя.':
    'Defines what happens when the required child layer is missing: skip the object or keep its current name.',

  'Добавляет перед новым именем значение другого дочернего слоя. Например Type=Phones и Name=iPhone → Phones/iPhone.':
    'Adds the value of another child layer before the new name. For example, Type=Phones and Name=iPhone → Phones/iPhone.',

  'Имя дочернего слоя, значение которого используется как часть пути перед основным именем.':
    'Name of the child layer whose value is used as the path segment before the main name.',

  'Эти правила применяются после основного переименования и приводят итоговые имена к единому формату.':
    'These rules are applied after the main rename operation to normalize final names.',

  'Удаляет пробелы в начале и конце итогового имени.':
    'Removes spaces at the beginning and end of the final name.',

  'Заменяет несколько последовательных пробелов одним.':
    'Replaces multiple consecutive spaces with a single space.',

  'Позволяет оставить пробелы, заменить их на дефис или подчёркивание либо полностью удалить.':
    'Lets you keep spaces, replace them with a hyphen or underscore, or remove them completely.',

  'Позволяет сохранить слеш как иерархию либо заменить его на дефис, подчёркивание или удалить. Если оставить, то слой с именем Type/Model экспортируется с именем Model во вновь созданную папку Type.':
    'Lets you keep the slash as hierarchy, replace it with a hyphen or underscore, or remove it. If hierarchy is kept, a layer named Type/Model is exported as Model inside a newly created Type folder.',

  'Каждый символ, указанный в этом поле, будет удалён из итогового имени.':
    'Every character entered in this field is removed from the final name.',

  'Позволяет сохранить исходный регистр, преобразовать имя в lowercase, UPPERCASE или Capitalize Words.':
    'Keeps the original case or converts the name to lowercase, UPPERCASE, or Capitalize Words.',

  'Добавляется перед уже полностью сформированным и обработанным именем.':
    'Added before the fully generated and processed name.',

  'Добавляется после уже полностью сформированного и обработанного имени.':
    'Added after the fully generated and processed name.',


  /* APPROVED TOOLTIPS — IMAGES */

  'Настройки IMAGE-заливок в текущем выделении и во вложенных объектах.':
    'Settings for IMAGE fills in the current selection and nested objects.',

  'Fit показывает изображение целиком. Fill заполняет объект с возможной обрезкой краёв. Crop позволяет управлять кадрированием. Tile повторяет изображение плиткой.':
    'Fit shows the entire image. Fill covers the object and may crop the edges. Crop lets you control framing. Tile repeats the image as a pattern.',

  'Сохраняет текущий режим IMAGE-заливки.':
    'Keeps the current IMAGE fill mode.',

  'Вписывает изображение целиком внутрь объекта. По краям может остаться свободное место.':
    'Fits the entire image inside the object. Empty space may remain around the edges.',

  'Полностью заполняет объект изображением. Часть изображения может выйти за границы и быть обрезана.':
    'Completely covers the object with the image. Parts of the image may extend beyond the bounds and be cropped.',

  'Использует режим кадрирования и позволяет управлять положением изображения внутри объекта.':
    'Uses crop mode and lets you control the image position inside the object.',

  'Повторяет изображение внутри объекта как плитку.':
    'Repeats the image inside the object as a tile pattern.',

  'Ищет IMAGE-заливки не только в выбранном объекте, но и во всех его вложенных слоях.':
    'Searches for IMAGE fills not only in the selected object but also in all nested layers.',

  'Позволяет уменьшить физический размер слишком большого исходного изображения без изменения размера объекта в Figma.':
    'Reduces an oversized source bitmap without changing the object size in Figma.',

  'Создаёт уменьшенную версию bitmap под фактический размер объекта. TILE при оптимизации пропускается.':
    'Creates a smaller bitmap based on the actual object size. TILE fills are skipped during optimization.',

  '1× создаёт bitmap примерно под фактический размер объекта. 2× сохраняет двойной запас разрешения.':
    '1× creates a bitmap approximately matching the actual object size. 2× keeps twice the resolution.',

  'Определяет, к какой стороне или углу привязано изображение при Fill или Crop. Центральная точка оставляет изображение по центру.':
    'Defines which side or corner the image is anchored to in Fill or Crop mode. The center point keeps the image centered.',


  /* COMMON STATUS / ERRORS */

  'Буквы станут векторными контурами и сохранят внешний вид.':
    'Text will become vector outlines while preserving its appearance.',

  'Текст останется редактируемым. Визуальная основа PDF экспортируется нативно средствами Figma.':
    'Text remains editable. The visual PDF base is exported natively by Figma.',

  'Текст останется текстом.':
    'Text remains text.',

  'Установка Helper отменена.':
    'Helper installation was cancelled.',

  'ICC-профиль должен быть не больше 4 МБ.':
    'ICC profile must not exceed 4 MB.',

  'Выберите CMYK ICC-профиль.':
    'Select a CMYK ICC profile.',

  'Подготовка экспорта…':
    'Preparing export…',

  'Версия локального конвертера несовместима. Пересоберите Helper.':
    'The local converter version is incompatible. Rebuild Helper.',

  'Ghostscript не установлен. Выполните npm run setup:gs.':
    'Ghostscript is not installed. Run npm run setup:gs.',

  'Модуль PDF с редактируемым текстом не установлен. Выполните npm run setup:browser.':
    'The editable-text PDF module is not installed. Run npm run setup:browser.',

  'Выберите ICC-профиль типографии.':
    'Select the print shop ICC profile.',

  'Базовый ICC-профиль не найден.':
    'Default ICC profile was not found.',

  'Ошибка подготовки.':
    'Preparation error.',

  'Формирование общего PDF…':
    'Creating merged PDF…',

  'Не удалось сформировать общий PDF.':
    'Failed to create merged PDF.',

  'Ошибка конвертации.':
    'Conversion error.',

  'Некорректный размер изображения.':
    'Invalid image dimensions.',

  'Canvas 2D недоступен.':
    'Canvas 2D is unavailable.',

  'Не удалось создать уменьшенное изображение.':
    'Failed to create the resized image.',

  'Готовые файлы очищены.':
    'Exported files cleared.',

  'Новая версия Helper скачана. Установите её поверх текущей.':
    'A new Helper version has been downloaded. Install it over the current version.',

  'Изменений нет.':
    'No changes.',

  'Совпадений не найдено.':
    'No matches found.',

  'В выбранной области IMAGE-заливки не найдены.':
    'No IMAGE fills were found in the selected scope.',

  'Выберите слой или несколько слоёв.':
    'Select one or more layers.',

  'Выберите слой или смените область поиска.':
    'Select a layer or change the search scope.',

  'Выберите слой с IMAGE-заливкой или фрейм.':
    'Select a layer with an IMAGE fill or a frame.',

  'Ошибка предпросмотра.':
    'Preview error.',

  'Ошибка операции.':
    'Operation error.',

  'Запускаю локальный конвертер…':
    'Starting local converter…',

  'Проверяю локальный конвертер…':
    'Checking local converter…',

  'Helper скачан. Установите его по инструкции в ZIP — экспорт продолжится автоматически.':
    'Helper has been downloaded. Install it using the instructions in the ZIP — export will continue automatically.',

  'Конвертер не запустился.':
    'Converter did not start.',

  'Локальный конвертер не ответил вовремя.':
    'Local converter timed out.',

  'Нет токена.':
    'Missing token.',

  'Нарушена последовательность потокового экспорта.':
    'Streaming export sequence error.',

  'Некорректные параметры экспорта: сообщение UI не прошло валидацию.':
    'Invalid export parameters: the UI message failed validation.',

  'Ошибка экспорта.':
    'Export error.',

  'Выберите хотя бы один слой или фрейм.':
    'Select at least one layer or frame.',

  'Для CMYK выберите PDF. SVG экспортируется в RGB.':
    'Use PDF for CMYK. SVG is exported in RGB.',

  'Один из выбранных слоёв удалён. Повторите экспорт.':
    'One of the selected layers was deleted. Run the export again.',
};


/* === TOOLTIP I18N START === */

const TOOLTIP_RU_EN:
  Record<string, string> =
{
  "Преобразует текстовые объекты в векторные контуры перед экспортом. Внешний вид сохраняется, но текст больше нельзя будет редактировать как текст. Полезно для передачи файлов в типографию на печать – так шрифты не слетят": "Converts text objects to vector outlines before export. The appearance is preserved, but the text can no longer be edited as text. Useful when sending files to a print shop so fonts cannot be substituted or lost.",
  "Имя слоя Figma, содержащего контур резки. При экспорте он будет вынесен отдельно для плоттера или типографии.": "The name of the Figma layer containing the cut contour. During export it is separated for a cutting plotter or print shop.",
  "Имя плашечного цвета, назначаемого контуру резки. Обычно типографии используют CutContour.": "The spot color name assigned to the cut contour. Print shops commonly use CutContour.",
  "Включает наложение краски для контура резки. CutContour не будет вырезать под собой фон при печати.": "Enables overprint for the cut contour. CutContour will not knock out the artwork underneath when printed.",
  "Толщина контура резки в итоговом PDF, в пунктах. Обычно достаточно 0,25 pt.": "Cut contour stroke width in the final PDF, in points. 0.25 pt is usually sufficient.",
  "Уменьшает слишком большие растровые изображения до размера, достаточного для макета. Оригинальные изображения и объекты в Figma не изменяются. Примените, если экспорт идет долго или упирается в лимит 100мб.": "Reduces oversized raster images to a resolution sufficient for the layout. Original images and Figma objects are not modified. Use this if export is slow or reaches the 100 MB limit.",
  "Физический размер PDF берётся из размера фрейма: 1 px в Figma = 1 мм в итоговом файле.": "The physical PDF size is taken from the frame dimensions: 1 px in Figma = 1 mm in the final file.",
  "Позволяет вручную задать физическую ширину и высоту итогового PDF в миллиметрах.": "Lets you manually set the physical width and height of the final PDF in millimeters.",
  "Дополнительный множитель итогового физического размера. Можно выбрать 0,5 / 1 / 2 / 3 или ввести своё значение.": "An additional multiplier for the final physical size. Choose 0.5 / 1 / 2 / 3 or enter a custom value.",
  "Цветовой профиль для преобразования в CMYK. Можно выбрать ранее добавленный профиль или загрузить новый ICC/ICM-файл типографии.": "Color profile used for CMYK conversion. Select a previously added profile or load a new ICC/ICM profile supplied by the print shop.",
  "Поиск и массовая замена текста. По умолчанию изменения применяются только внутри текущего выделения.": "Find and replace text in bulk. By default, changes are applied only inside the current selection.",
  "Выделение — только выбранные объекты. Текущая страница — все подходящие слои на странице. Весь документ — поиск по всем страницам файла.": "Selection — selected objects only. Current page — all matching layers on the current page. Entire document — search all pages in the file.",
  "Текст, который нужно найти. Можно использовать ↵ для переноса строки и ⇥ для табуляции.": "Text to find. Use ↵ for a line break and ⇥ for a tab.",
  "Новый текст. Оставьте поле пустым, если найденный текст нужно удалить. Поддерживаются ↵ и ⇥.": "Replacement text. Leave this field empty to delete the matched text. ↵ and ⇥ are supported.",
  "Если включено, ABC и abc считаются разными строками.": "When enabled, ABC and abc are treated as different strings.",
  "Совпадение должно быть отдельным словом, а не частью другого слова.": "The match must be a complete word rather than part of another word.",
  "Использует регулярные выражения вместо обычного поиска. Примеры: \\d+ — любое число, \\s+ — пробелы, .* — любой текст, (...) — группа захвата. В поле замены можно использовать $1, $2 и далее для групп, $& — всё найденное совпадение, $<name> — именованную группу.": "Uses regular expressions instead of plain-text search. Examples: \\d+ — any number, \\s+ — whitespace, .* — any text, (...) — a capture group. In Replace you can use $1, $2, etc. for capture groups, $& for the full match, and $<name> for a named group.",
  "Слой будет изменён только если он целиком состоит из поискового запроса. Например, при поиске «Хуй» слой «Хуй» изменится, а слой «Хуй моржовый» — нет.": "The layer is changed only when its entire text matches the search query. For example, searching for “Foo” changes a layer containing only “Foo”, but not a layer containing “Foo bar”.",
  "Включает в поиск скрытые текстовые слои.": "Includes hidden text layers in the search.",
  "Группа настроек, которая ограничивает, в каких текстовых слоях выполнять поиск. Фильтрация идёт по имени слоя, а не по тексту внутри него.": "A group of settings that limits which text layers are searched. Filtering uses the layer name, not the text inside the layer.",
  "Искать текст только в слоях, имя которых содержит указанную строку. Например, значение Title подойдёт для Title, Product Title и TITLE. Регистр имени не учитывается.": "Search only layers whose name contains the specified string. For example, Title matches Title, Product Title, and TITLE. Layer-name matching is case-insensitive.",
  "Не искать текст в слоях, имя которых содержит указанную строку. Например, значение Button исключит Button, Main Button и BUTTON. Регистр имени не учитывается.": "Exclude layers whose name contains the specified string. For example, Button excludes Button, Main Button, and BUTTON. Layer-name matching is case-insensitive.",
  "Массовое переименование выбранных объектов. Перед применением результат можно проверить в предпросмотре.": "Bulk rename selected objects. Review the result in Preview before applying it.",
  "Определяет, как будет сформировано новое имя: замена текста, префикс/суффикс, полное имя, нумерация, шаблон или значение дочернего слоя.": "Defines how the new name is created: text replacement, prefix/suffix, full name, numbering, template, or a value from a child layer.",
  "Применяет переименование не только к выбранным объектам, но и к их дочерним слоям.": "Applies renaming not only to selected objects but also to their child layers.",
  "Использует регулярное выражение вместо обычного поиска по имени слоя. Примеры: \\d+ — любое число, .* — любой текст, ^icon- — имя начинается с icon-, -old$ — имя заканчивается на -old. Группы можно использовать для поиска сложных шаблонов.": "Uses a regular expression instead of plain-text layer-name search. Examples: \\d+ — any number, .* — any text, ^icon- — name starts with icon-, -old$ — name ends with -old. Capture groups can be used for more complex patterns.",
  "Префикс добавляет указанный текст перед текущим именем слоя. Суффикс добавляет указанный текст после текущего имени слоя.": "Prefix adds the specified text before the current layer name. Suffix adds it after the current layer name.",
  "Формирует имена из общей основы и последовательного номера. Start — первое число последовательности. Digits — количество цифр в номере. Например, 2 превращает 1 в 01.": "Creates names from a common base and a sequential number. Start is the first number in the sequence. Digits sets the number of digits; for example, 2 turns 1 into 01.",
  "Создаёт имя по шаблону. Доступны переменные {name}, {index}, {width}, {height} и {type}.": "Creates a name from a template. Available variables: {name}, {index}, {width}, {height}, and {type}.",
  "Ищет внутри объекта слой с заданным именем. Для TEXT берётся его текст, для других типов — имя найденного слоя.": "Searches inside the object for a layer with the specified name. For TEXT layers, its text is used; for other types, the found layer name is used.",
  "Первый уровень ищет только среди непосредственных дочерних слоёв. Любая глубина ищет во всём дереве объекта.": "First level searches only direct child layers. Any depth searches the entire object tree.",
  "Определяет поведение, если нужный дочерний слой отсутствует: пропустить объект или оставить текущее имя.": "Defines what happens when the required child layer is missing: skip the object or keep its current name.",
  "Добавляет перед новым именем значение другого дочернего слоя. Например Type=Phones и Name=iPhone → Phones/iPhone.": "Adds the value of another child layer before the new name. For example, Type=Phones and Name=iPhone → Phones/iPhone.",
  "Эти правила применяются после основного переименования и приводят итоговые имена к единому формату.": "These rules are applied after the main rename operation to normalize final names.",
  "Удаляет пробелы в начале и конце итогового имени.": "Removes spaces at the beginning and end of the final name.",
  "Заменяет несколько последовательных пробелов одним.": "Replaces multiple consecutive spaces with a single space.",
  "Позволяет оставить пробелы, заменить их на дефис или подчёркивание либо полностью удалить.": "Lets you keep spaces, replace them with a hyphen or underscore, or remove them completely.",
  "Позволяет сохранить слеш как иерархию либо заменить его на дефис, подчёркивание или удалить. Если оставить, то слой с именем Type/Model экспортируется с именем Model во вновь созданную папку Type.": "Lets you keep the slash as hierarchy, replace it with a hyphen or underscore, or remove it. If hierarchy is kept, a layer named Type/Model is exported as Model inside a newly created Type folder.",
  "Каждый символ, указанный в этом поле, будет удалён из итогового имени.": "Every character entered in this field is removed from the final name.",
  "Позволяет сохранить исходный регистр, преобразовать имя в lowercase, UPPERCASE или Capitalize Words.": "Keeps the original case or converts the name to lowercase, UPPERCASE, or Capitalize Words.",
  "Добавляется перед уже полностью сформированным и обработанным именем.": "Added before the fully generated and processed name.",
  "Добавляется после уже полностью сформированного и обработанного имени.": "Added after the fully generated and processed name.",
  "Настройки IMAGE-заливок в текущем выделении и во вложенных объектах.": "Settings for IMAGE fills in the current selection and nested objects.",
  "Fit показывает изображение целиком. Fill заполняет объект с возможной обрезкой краёв. Crop позволяет управлять кадрированием. Tile повторяет изображение плиткой.": "Fit shows the entire image. Fill covers the object and may crop the edges. Crop lets you control framing. Tile repeats the image as a pattern.",
  "Ищет IMAGE-заливки не только в выбранном объекте, но и во всех его вложенных слоях.": "Searches for IMAGE fills not only in the selected object but also in all nested layers.",
  "Позволяет уменьшить физический размер слишком большого исходного изображения без изменения размера объекта в Figma.": "Reduces an oversized source bitmap without changing the object size in Figma.",
  "Создаёт уменьшенную версию bitmap под фактический размер объекта. TILE при оптимизации пропускается.": "Creates a smaller bitmap based on the actual object size. TILE fills are skipped during optimization.",
  "1× создаёт bitmap примерно под фактический размер объекта. 2× сохраняет двойной запас разрешения.": "1× creates a bitmap approximately matching the actual object size. 2× keeps twice the resolution.",
  "Определяет, к какой стороне или углу привязано изображение при Fill или Crop. Центральная точка оставляет изображение по центру.": "Defines which side or corner the image is anchored to in Fill or Crop mode. The center point keeps the image centered."
};

/* === TOOLTIP I18N END === */


/* === DEPENDENCY I18N START === */

const DEPENDENCY_RU_EN:
  Record<string, string> = {
    'Зависимости':
      'Dependencies',

    'Слой':
      'Layer',

    'Разделитель':
      'Separator',

    '+ Добавить зависимость':
      '+ Add dependency',

    'Добавляет значения других дочерних слоёв перед основным именем. Для каждой зависимости можно выбрать слой и разделитель. Зависимостей может быть несколько.':
      'Adds values from other child layers before the main name. Each dependency can use its own layer and separator. Multiple dependencies can be added.',
  };

/* === DEPENDENCY I18N END === */


/* === THANKS I18N START === */

const THANKS_RU_EN:
  Record<string, string> = {

  'Сказать спасибо':
    'Say thanks',

  'Задать вопрос':
    'Ask a question',

  'Если Export to PDF / SVG + Batch Rename оказался полезен и сэкономил вам время, можно поддержать разработку плагина.':
    'If Export to PDF / SVG + Batch Rename has been useful and saved you time, you can support the development of the plugin.',

  'TON / USDT (сеть TON)':
    'TON / USDT (TON network)',

  'Скопировать':
    'Copy',

  'Скопировано':
    'Copied',

  'Вопросы и проблемы':
    'Questions and problems',

  'Если что-то не работает или есть вопрос по плагину — напишите на почту.':
    'If something is not working or you have a question about the plugin, send an email.',

  'Любая поддержка помогает развивать плагин и выпускать обновления.':
    'Every contribution helps improve the plugin and fund future updates.',

  'Закрыть':
    'Close',
};

/* === THANKS I18N END === */


const RU_EN =
  new Map<string, string>(
    Object.entries(
      {
        ...RU_EN_SOURCE,
        ...TOOLTIP_RU_EN,
        ...DEPENDENCY_RU_EN,
        ...THANKS_RU_EN,
      },
    ).map(
      ([ru, en]) => [
        normalize(ru),
        en,
      ],
    ),
  );


function translateDynamic(
  value: string,
): string | null {

  let match:
    RegExpMatchArray |
    null;


  match =
    value.match(
      /^Выбрано сло(?:е|ё)в:\s*(.+)$/i,
    );

  if (match) {
    return `Selected layers: ${match[1]}`;
  }


  match =
    value.match(
      /^Выбран профиль:\s*(.+)$/i,
    );

  if (match) {
    return `Selected profile: ${match[1]}`;
  }


  match =
    value.match(
      /^ICC-профиль сохранён:\s*(.+)$/i,
    );

  if (match) {
    return `ICC profile saved: ${match[1]}`;
  }


  match =
    value.match(
      /^Преобразование\s+(\d+)\s+из\s+(\d+)…?$/,
    );

  if (match) {
    return `Converting ${match[1]} of ${match[2]}…`;
  }


  match =
    value.match(
      /^Экспорт из Figma:\s*(\d+)\s+из\s+(\d+)…?$/,
    );

  if (match) {
    return `Exporting from Figma: ${match[1]} of ${match[2]}…`;
  }


  match =
    value.match(
      /^Общий PDF сформирован:\s*(\d+)\s+стр\.$/,
    );

  if (match) {
    return `Merged PDF created: ${match[1]} pages.`;
  }


  match =
    value.match(
      /^Готово:\s*(\d+)\s+файл\(ов\),\s*(.+?)\.$/,
    );

  if (match) {
    return `Done: ${match[1]} file(s), ${match[2]}.`;
  }


  match =
    value.match(
      /^Готово:\s*(\d+)\s+файл\(ов\),\s*(.+?)\.\s*Большой пакет выгружен потоково\.$/,
    );

  if (match) {
    return `Done: ${match[1]} file(s), ${match[2]}. Large batch was exported as a stream.`;
  }


  match =
    value.match(
      /^До:\s*(.*)$/s,
    );

  if (match) {
    return `Before: ${match[1]}`;
  }


  match =
    value.match(
      /^После:\s*(.*)$/s,
    );

  if (match) {
    return `After: ${match[1]}`;
  }


  match =
    value.match(
      /^Будет изменено:\s*(\d+)\s+из\s+(\d+)$/,
    );

  if (match) {
    return `Will change: ${match[1]} of ${match[2]}`;
  }


  match =
    value.match(
      /^Пропущено:\s*(\d+)$/,
    );

  if (match) {
    return `Skipped: ${match[1]}`;
  }


  match =
    value.match(
      /^Совпадений:\s*(\d+)\s*·\s*слоёв:\s*(\d+)\s+из\s+(\d+)$/,
    );

  if (match) {
    return `Matches: ${match[1]} · layers: ${match[2]} of ${match[3]}`;
  }


  match =
    value.match(
      /^IMAGE-заливок:\s*(\d+)\s*·\s*слоёв:\s*(\d+)$/,
    );

  if (match) {
    return `IMAGE fills: ${match[1]} · layers: ${match[2]}`;
  }


  match =
    value.match(
      /^Можно уменьшить bitmap:\s*(\d+)$/,
    );

  if (match) {
    return `Bitmaps that can be reduced: ${match[1]}`;
  }


  match =
    value.match(
      /^Готово\. Переименовано:\s*(\d+)\. Пропущено:\s*(\d+)\.$/,
    );

  if (match) {
    return `Done. Renamed: ${match[1]}. Skipped: ${match[2]}.`;
  }


  match =
    value.match(
      /^Готово\. Изменено текстовых слоёв:\s*(\d+)\. Замен:\s*(\d+)\. Пропущено:\s*(\d+)\.$/,
    );

  if (match) {
    return `Done. Text layers changed: ${match[1]}. Replacements: ${match[2]}. Skipped: ${match[3]}.`;
  }


  match =
    value.match(
      /^Готово\. Режим изменён у IMAGE-заливок:\s*(\d+)\. Bitmap уменьшено:\s*(\d+)\. Пропущено:\s*(\d+)\.$/,
    );

  if (match) {
    return `Done. IMAGE fill mode changed: ${match[1]}. Bitmaps reduced: ${match[2]}. Skipped: ${match[3]}.`;
  }


  match =
    value.match(
      /^Helper не запустился после установки:\s*(.+)$/s,
    );

  if (match) {
    return `Helper did not start after installation: ${match[1]}`;
  }


  match =
    value.match(
      /^Launcher вернул HTTP\s+(\d+)$/,
    );

  if (match) {
    return `Launcher returned HTTP ${match[1]}`;
  }


  match =
    value.match(
      /^Ошибка конвертера\s*\((\d+)\)\.$/,
    );

  if (match) {
    return `Converter error (${match[1]}).`;
  }


  match =
    value.match(
      /^UI не подтвердил обработку файла\s+(\d+)\.$/,
    );

  if (match) {
    return `UI did not confirm processing file ${match[1]}.`;
  }


  match =
    value.match(
      /^Не удалось обработать файл\s+(\d+)\.$/,
    );

  if (match) {
    return `Failed to process file ${match[1]}.`;
  }


  match =
    value.match(
      /^Фрейм "(.+)" превышает 100 МБ промежуточных данных\.$/s,
    );

  if (match) {
    return `Frame "${match[1]}" exceeds 100 MB of intermediate data.`;
  }


  return null;
}


function translatedCore(
  core: string,
): string {

  const dynamic =
    translateDynamic(
      core,
    );

  if (dynamic) {
    return dynamic;
  }

  return (
    RU_EN.get(
      normalize(core),
    ) ??
    core
  );
}


function translateValue(
  raw: string,
): string {

  const leading =
    raw.match(/^\s*/)?.[0] ??
    '';

  const trailing =
    raw.match(/\s*$/)?.[0] ??
    '';

  const core =
    normalize(raw);

  if (!core) {
    return raw;
  }

  const translated =
    translatedCore(
      core,
    );

  if (
    translated ===
    core
  ) {
    return raw;
  }

  return (
    leading +
    translated +
    trailing
  );
}


const originalText =
  new WeakMap<
    Text,
    string
  >();


const originalAttrs =
  new WeakMap<
    Element,
    Map<string, string>
  >();


const translatedAttributes =
  [
    'data-tip',
    'title',
    'placeholder',
    'aria-label',
  ] as const;


let language:
  UiLanguage =
  'ru';


let applying =
  false;


function storedLanguage():
  UiLanguage {

  try {
    return (
      localStorage.getItem(
        'layer-export-language',
      ) === 'en'
        ? 'en'
        : 'ru'
    );
  } catch {
    return 'ru';
  }
}


function saveLanguage(
  value: UiLanguage,
): void {

  try {
    localStorage.setItem(
      'layer-export-language',
      value,
    );
  } catch {
    // Ignore storage errors.
  }
}


function userContentNode(
  node: Text,
): boolean {

  const parent =
    node.parentElement;

  if (!parent) {
    return false;
  }

  return Boolean(
    parent.closest(
      'script, style, template, noscript, .selection-name, a.download, .brand-title, .brand-subtitle',
    ),
  );
}


function translateTextNode(
  node: Text,
): void {

  if (
    userContentNode(
      node,
    )
  ) {
    return;
  }

  const current =
    node.nodeValue ??
    '';

  if (
    language === 'ru'
  ) {
    const original =
      originalText.get(
        node,
      );

    if (
      original !==
      undefined &&
      current !==
      original
    ) {
      node.nodeValue =
        original;
    }

    return;
  }


  if (
    CYRILLIC.test(
      current,
    )
  ) {
    originalText.set(
      node,
      current,
    );
  }


  const source =
    CYRILLIC.test(
      current,
    )
      ? current
      : originalText.get(
          node,
        );


  if (
    source ===
    undefined
  ) {
    return;
  }


  const translated =
    translateValue(
      source,
    );


  if (
    translated !==
    current
  ) {
    node.nodeValue =
      translated;
  }
}


function translateElementAttributes(
  element: Element,
): void {

  for (
    const attribute
    of translatedAttributes
  ) {
    if (
      !element.hasAttribute(
        attribute,
      )
    ) {
      continue;
    }

    const current =
      element.getAttribute(
        attribute,
      ) ??
      '';

    let originals =
      originalAttrs.get(
        element,
      );

    if (!originals) {
      originals =
        new Map();

      originalAttrs.set(
        element,
        originals,
      );
    }


    if (
      language === 'ru'
    ) {
      const original =
        originals.get(
          attribute,
        );

      if (
        original !==
        undefined &&
        current !==
        original
      ) {
        element.setAttribute(
          attribute,
          original,
        );
      }

      continue;
    }


    if (
      CYRILLIC.test(
        current,
      )
    ) {
      originals.set(
        attribute,
        current,
      );
    }


    const source =
      CYRILLIC.test(
        current,
      )
        ? current
        : originals.get(
            attribute,
          );


    if (
      source ===
      undefined
    ) {
      continue;
    }


    const translated =
      translateValue(
        source,
      );


    if (
      translated !==
      current
    ) {
      element.setAttribute(
        attribute,
        translated,
      );
    }
  }
}


function applySubtree(
  root: Node,
): void {

  if (
    root instanceof Element &&
    root.matches(
      'script, style, template, noscript',
    )
  ) {
    return;
  }

  if (
    root.nodeType ===
    Node.TEXT_NODE
  ) {
    translateTextNode(
      root as Text,
    );

    return;
  }


  if (
    root.nodeType !==
    Node.ELEMENT_NODE &&
    root.nodeType !==
    Node.DOCUMENT_NODE &&
    root.nodeType !==
    Node.DOCUMENT_FRAGMENT_NODE
  ) {
    return;
  }


  if (
    root instanceof Element
  ) {
    translateElementAttributes(
      root,
    );
  }


  const walker =
    document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT |
      NodeFilter.SHOW_TEXT,
    );


  let current:
    Node |
    null;


  while (
    (
      current =
        walker.nextNode()
    )
  ) {
    if (
      current.nodeType ===
      Node.TEXT_NODE
    ) {
      translateTextNode(
        current as Text,
      );
    } else if (
      current instanceof
      Element
    ) {
      translateElementAttributes(
        current,
      );
    }
  }
}


/* === CUT INPUT LANGUAGE DEFAULT START === */

function syncCutLayerDefault():
  void {

  const input =
    document.getElementById(
      'print-layer-name',
    ) as
      HTMLInputElement |
      null;


  if (!input) {
    return;
  }


  if (
    input.dataset
      .i18nCutDefault !==
    'true'
  ) {
    return;
  }


  input.value =
    language === 'en'
      ? 'cut'
      : 'rezka';
}


/* === CUT INPUT LANGUAGE DEFAULT END === */


function updateSwitch(): void {

  const ru =
    document.getElementById(
      'language-ru',
    ) as
      HTMLButtonElement |
      null;

  const en =
    document.getElementById(
      'language-en',
    ) as
      HTMLButtonElement |
      null;

  const wrapper =
    document.getElementById(
      'language-switch',
    );


  if (
    !ru ||
    !en ||
    !wrapper
  ) {
    return;
  }


  const isRu =
    language ===
    'ru';


  ru.classList.toggle(
    'active',
    isRu,
  );

  en.classList.toggle(
    'active',
    !isRu,
  );


  ru.setAttribute(
    'aria-pressed',
    String(
      isRu,
    ),
  );

  en.setAttribute(
    'aria-pressed',
    String(
      !isRu,
    ),
  );


  wrapper.setAttribute(
    'aria-label',
    isRu
      ? 'Язык интерфейса'
      : 'Interface language',
  );
}


function setLanguage(
  next: UiLanguage,
): void {

  language =
    next;

  saveLanguage(
    next,
  );


  document.documentElement.lang =
    next === 'ru'
      ? 'ru'
      : 'en';


  applying =
    true;

  try {
    applySubtree(
      document.body,
    );

    syncCutLayerDefault();

    updateSwitch();
  } finally {
    applying =
      false;
  }
}


function auditEnglishUi(): void {

  if (
    language !==
    'en'
  ) {
    return;
  }


  const missing =
    new Set<string>();


  const walker =
    document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );


  let node:
    Node |
    null;


  while (
    (
      node =
        walker.nextNode()
    )
  ) {
    const text =
      node as Text;

    if (
      userContentNode(
        text,
      )
    ) {
      continue;
    }

    const value =
      normalize(
        text.nodeValue ??
        '',
      );

    if (
      value &&
      CYRILLIC.test(
        value,
      )
    ) {
      missing.add(
        value,
      );
    }
  }


  if (
    missing.size
  ) {
    console.warn(
      '[i18n] Untranslated UI strings:',
      [
        ...missing,
      ]
        .slice(
          0,
          30,
        )
        .map(
          value =>
            value.slice(
              0,
              300,
            ),
        ),
    );
  }
}


export function initI18n():
  void {

  const cutLayerInput =
    document.getElementById(
      'print-layer-name',
    ) as
      HTMLInputElement |
      null;


  if (
    cutLayerInput &&
    (
      cutLayerInput.value ===
        'rezka' ||
      cutLayerInput.value ===
        'cut'
    )
  ) {
    cutLayerInput.dataset
      .i18nCutDefault =
      'true';


    cutLayerInput.addEventListener(
      'input',
      () => {
        cutLayerInput.dataset
          .i18nCutDefault =
          'false';
      },
      {
        once:
          true,
      },
    );
  }

  const ru =
    document.getElementById(
      'language-ru',
    );

  const en =
    document.getElementById(
      'language-en',
    );


  ru?.addEventListener(
    'click',
    () => {
      setLanguage(
        'ru',
      );
    },
  );


  en?.addEventListener(
    'click',
    () => {
      setLanguage(
        'en',
      );
    },
  );


  const observer =
    new MutationObserver(
      mutations => {

        if (applying) {
          return;
        }


        applying =
          true;

        try {
          for (
            const mutation
            of mutations
          ) {

            if (
              mutation.type ===
              'characterData'
            ) {
              const textTarget =
                mutation.target as Text;

              translateTextNode(
                textTarget,
              );

              continue;
            }


            if (
              mutation.type ===
              'attributes' &&
              mutation.target
                instanceof Element
            ) {
              translateElementAttributes(
                mutation.target,
              );

              continue;
            }


            for (
              const added
              of Array.from(
                mutation.addedNodes,
              )
            ) {
              applySubtree(
                added,
              );
            }
          }
        } finally {
          applying =
            false;
        }


      },
    );


  observer.observe(
    document.body,
    {
      subtree:
        true,

      childList:
        true,

      characterData:
        true,

      attributes:
        true,

      attributeFilter: [
        'data-tip',
        'title',
        'placeholder',
        'aria-label',
      ],
    },
  );


  setLanguage(
    storedLanguage(),
  );


  window.setTimeout(
    auditEnglishUi,
    0,
  );
}
