const groups = ["空中飛行", "貼地爬行", "陸上步行", "水中游動"];
const traits = {
  wings: "有翅膀", six: "有六隻腳", feather: "有羽毛", four: "有四隻步行用的腳",
  shell: "背上有明顯的硬殼", fin: "有魚類的鰭", zero: "沒有步行用的腳",
  eight: "有八隻步足", two: "有兩隻步行用的腳"
};
// The labels describe the illustrated adults, including caste or sex where specified.
const animals = [
  ["swallow","家燕","尾端像剪刀一樣分叉","wings feather two"],
  ["egret","大白鷺","長頸呈 S 形，腿細長","wings feather two"],
  ["kingfisher","普通翠鳥","有亮藍色的背和橙色的腹","wings feather two"],
  ["sparrow","麻雀","白色臉頰有黑斑","wings feather two"],
  ["pigeon","原鴿","灰色翅膀上有兩道黑帶","wings feather two"],
  ["butterfly","樺斑蝶","橙色翅膀有黑邊與白點","wings six"],
  ["dragonfly","薄翅蜻蜓","兩對狹長翅膀向左右張開","wings six"],
  ["bee","西方蜜蜂","腹部有黃褐與深色的環帶","wings six"],
  ["ladybird","七星瓢蟲","紅色鞘翅上有七個黑點","wings six"],
  ["moth","長尾水青蛾（雄蛾）","淡綠色後翅拖著兩條長尾","wings six"],
  ["snake","赤尾青竹絲","有綠色長身體和紅褐色尾端","zero"],
  ["snail","非洲大蝸牛","背上有長錐形螺旋殼","shell zero"],
  ["worm","歐洲大蚯蚓","長身體有一圈較粗的環帶","zero"],
  ["ant","黑棘蟻（工蟻）","胸部與腹部之間細窄","six"],
  ["spider","人面蜘蛛（雌蛛）","腹部有黃色斑紋，步足細長","eight"],
  ["centipede","少棘蜈蚣","身體多節，多數體節各有一對足",""],
  ["millipede","美洲巨馬陸","圓筒狀身體下方有密集短足",""],
  ["alligator","美洲短吻鱷","寬扁的吻端呈 U 形","four"],
  ["gecko","鉛山壁虎","趾端寬扁，尾巴細長","four"],
  ["tortoise","亞達伯拉象龜","背上有高拱龜殼","four shell"],
  ["elephant","亞洲象","鼻子向前下方延伸成長鼻","four"],
  ["giraffe","長頸鹿","長頸上有褐色塊斑","four"],
  ["zebra","平原斑馬","軀幹布滿黑白條紋","four"],
  ["tiger","孟加拉虎","橙褐色軀幹有深色條紋","four"],
  ["panda","大貓熊","眼睛周圍有黑色斑塊","four"],
  ["goat","家山羊","下巴垂著一撮鬍鬚","four"],
  ["camel","單峰駱駝","背上有一個駝峰","four"],
  ["rhino","白犀牛","鼻部有前後兩支角","four"],
  ["hippo","河馬","寬厚的嘴部上方有突起鼻孔","four"],
  ["ostrich","非洲鴕鳥（雄鳥）","長腿末端各有兩個腳趾","wings feather two"],
  ["shark","路氏雙髻鯊","頭部向左右展寬，眼在兩端","fin zero"],
  ["ray","藍點魟","扁平的背上有藍色圓點","fin zero"],
  ["seahorse","大腹海馬","細長尾巴捲曲，身體直立","fin zero"],
  ["clown","眼斑雙鋸魚","橙色軀幹有三道白色帶紋","fin zero"],
  ["tuna","黃鰭鮪","背鰭與尾巴之間有一列黃色小鰭","fin zero"],
  ["puffer","黑斑叉鼻魨","圓胖軀幹有細小黑點","fin zero"],
  ["dolphin","瓶鼻海豚","短吻明顯，尾鰭左右水平展開","zero"],
  ["turtle","綠蠵龜","有扁平龜殼和槳狀前肢","shell zero"],
  ["octopus","真蛸","頭部下方伸出八條帶吸盤的腕","zero"],
  ["jelly","海月水母","傘體內可見四個環狀構造","zero"]
].map(([id, name, clue, flags], i) => ({
  id, name, clue, group: Math.floor(i / 10), flags: flags.split(" ")
}));

// Individual observations supplement shared features so every card can be identified.
const questions = [
  ...Object.entries(traits).map(([id, label]) => ({ id, label, test: animal => animal.flags.includes(id) })),
  ...animals.map(({id, clue}) => ({id, label: clue, test: animal => animal.id === id}))
];
const presets = [
  ["課堂示範", ["sparrow","dragonfly","ant","spider","butterfly","ostrich"]],
  ["池塘與海邊", ["egret","kingfisher","dragonfly","alligator","turtle","octopus","clown","ray"]],
  ["腳與外殼", ["snail","worm","ant","spider","centipede","millipede","tortoise","gecko"]],
  ["四處看看", ["swallow","bee","snake","tortoise","elephant","zebra","shark","jelly"]]
];
