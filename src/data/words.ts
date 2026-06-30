import type { WordEntry } from '../types'

const groups: Record<string, string[]> = {
  nature: ['太阳', '月亮', '星星', '海洋', '河流', '森林', '沙漠', '高山', '雨水', '雪花', '火焰', '云朵'],
  animal: ['熊猫', '老虎', '狮子', '大象', '海豚', '鲸鱼', '蝴蝶', '蜜蜂', '狐狸', '企鹅', '孔雀', '骆驼'],
  food: ['苹果', '香蕉', '草莓', '西瓜', '面包', '米饭', '饺子', '火锅', '咖啡', '牛奶', '蜂蜜', '巧克力'],
  object: ['钥匙', '雨伞', '镜子', '时钟', '相机', '书本', '铅笔', '吉他', '气球', '灯塔', '火车', '风筝'],
  concept: ['梦想', '勇气', '时间', '自由', '记忆', '秘密', '友谊', '希望', '智慧', '快乐', '和平', '音乐'],
}

export const WORDS: WordEntry[] = Object.entries(groups).flatMap(([category, words]) =>
  words.map((word, index) => ({ id: `${category}-${index}`, word, category })),
)
