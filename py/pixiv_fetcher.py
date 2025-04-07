import json
from pixivpy3 import AppPixivAPI


def createAPI() -> AppPixivAPI | None:
    try:
        with open("../py/client.json", "r") as file:
            client_data = json.load(file)
            REFRESH_TOKEN = client_data["refresh_token"]

        api = AppPixivAPI()
        api.auth(refresh_token=REFRESH_TOKEN)
        return api
    except Exception as e:
        print(f"Pixiv APIの初期化に失敗しました: {e}")
        return None  # エラー時は None を返す


def fetch_tags_from_pixiv(image_id: int) -> list:
    api = createAPI()
    if api is None:
        print("APIが初期化されていません。")
        return None

    # PixivAPIのリクエスト
    illust_info = api.illust_detail(image_id)

    if "illust" in illust_info and illust_info.illust is not None:
        tags = [tag["name"] for tag in illust_info.illust.tags]
        return tags
    return None
