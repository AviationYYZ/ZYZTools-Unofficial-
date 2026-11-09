#pragma once

#include <windows.h>
#include <winhttp.h>
#include <objidl.h>
#include <gdiplus.h>
#include <shlwapi.h>
#include <array>
#include <algorithm>
#include <chrono>
#include <future>
#include <memory>
#include <string>
#include <vector>

#pragma comment(lib, "Gdiplus.lib")
#pragma comment(lib, "Shlwapi.lib")

namespace WeatherOverlay {
using Clock=std::chrono::steady_clock;
using Bytes=std::vector<unsigned char>;
constexpr double West=-81.5, South=42.25, East=-77.5, North=45.25;
enum Layer { Rain=1, Lightning=2, Vertical=4 };
inline Bytes Fetch(const wchar_t* layer){
    struct Handle { HINTERNET value; ~Handle(){if(value)WinHttpCloseHandle(value);} };
    Handle session{WinHttpOpen(L"ZYZTools Weather/1",WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,nullptr,nullptr,0)};
    if(!session.value)return {};
    WinHttpSetTimeouts(session.value,3000,3000,4000,4000);
    Handle server{WinHttpConnect(session.value,L"geo.weather.gc.ca",INTERNET_DEFAULT_HTTPS_PORT,0)};
    if(!server.value)return {};
    std::wstring url=L"/geomet?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&CRS=CRS:84&BBOX=-81.5,42.25,-77.5,45.25&WIDTH=512&HEIGHT=512&FORMAT=image/png&TRANSPARENT=TRUE&STYLES=&LAYERS=";
    url+=layer;
    Handle request{WinHttpOpenRequest(server.value,L"GET",url.c_str(),nullptr,nullptr,nullptr,WINHTTP_FLAG_SECURE)};
    if(!request.value)return {};
    DWORD redirect=WINHTTP_OPTION_REDIRECT_POLICY_NEVER;
    WinHttpSetOption(request.value,WINHTTP_OPTION_REDIRECT_POLICY,&redirect,sizeof redirect);
    if(!WinHttpSendRequest(request.value,nullptr,0,nullptr,0,0,0)||!WinHttpReceiveResponse(request.value,nullptr))return {};
    DWORD status=0,size=sizeof status;
    if(!WinHttpQueryHeaders(request.value,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,nullptr,&status,&size,nullptr)||status!=200)return {};
    Bytes data;std::array<unsigned char,8192> buffer;DWORD count=0;
    const auto deadline=Clock::now()+std::chrono::seconds(12);
    do{
        if(Clock::now()>deadline||!WinHttpReadData(request.value,buffer.data(),static_cast<DWORD>(buffer.size()),&count))return {};
        data.insert(data.end(),buffer.begin(),buffer.begin()+count);
        if(data.size()>2*1024*1024)return {};
    }while(count);
    constexpr std::array<unsigned char,8> png{137,80,78,71,13,10,26,10};
    if(data.size()<24||!std::equal(png.begin(),png.end(),data.begin()))return {};
    // Accept only the requested dimensions before handing bytes to the decoder.
    if(data[16]||data[17]||data[18]!=2||data[19]||data[20]||data[21]||data[22]!=2||data[23])return {};
    return data;
}
class Overlay {
    struct Frame{
        IStream* stream=nullptr;
        std::unique_ptr<Gdiplus::Image> image;
        std::future<Bytes> pending;
        Clock::time_point next{},received{};
        void Clear(){image.reset();if(stream){stream->Release();stream=nullptr;}}
        ~Frame(){Clear();}
    };
    std::array<Frame,3> frames;
    ULONG_PTR gdip=0;
    static constexpr const wchar_t* sources[]={L"RADAR_1KM_RRAI",L"Lightning_2.5km_Density",L"RDPS_10km_VerticalVelocity_700mb"};
public:
    ~Overlay(){for(auto& f:frames)f.Clear();if(gdip)Gdiplus::GdiplusShutdown(gdip);}
    template<class Project>
    void Draw(HDC dc,const RECT& clip,int mask,Project project){
        if(!mask)return;
        if(!gdip){Gdiplus::GdiplusStartupInput input;if(Gdiplus::GdiplusStartup(&gdip,&input,nullptr)!=Gdiplus::Ok)return;}
        const auto now=Clock::now();
        const auto a=project(North,West),b=project(North,East),c=project(South,West);
        Gdiplus::Point points[]={{int(a.x),int(a.y)},{int(b.x),int(b.y)},{int(c.x),int(c.y)}};
        Gdiplus::Graphics graphics(dc);
        graphics.SetClip(Gdiplus::Rect(clip.left,clip.top,clip.right-clip.left,clip.bottom-clip.top));
        graphics.SetInterpolationMode(Gdiplus::InterpolationModeNearestNeighbor);
        bool loading=false,missing=false;
        for(int i:{2,0,1}){
            if(!(mask&(1<<i)))continue;
            auto& f=frames[i];
            if(f.pending.valid()&&f.pending.wait_for(std::chrono::seconds(0))==std::future_status::ready){
                try{
                    const auto bytes=f.pending.get();
                    if(!bytes.empty()){
                        auto* stream=SHCreateMemStream(bytes.data(),static_cast<UINT>(bytes.size()));
                        if(stream){
                            std::unique_ptr<Gdiplus::Image> image(Gdiplus::Image::FromStream(stream,FALSE));
                            if(image&&image->GetLastStatus()==Gdiplus::Ok){f.Clear();f.stream=stream;f.image=std::move(image);f.received=now;}
                            else{image.reset();stream->Release();}
                        }
                    }
                }catch(...){}
                f.next=now+(f.received==now?std::chrono::minutes(5):std::chrono::minutes(1));
            }
            // Serialize fetches so one radar screen never floods the service.
            if(!f.pending.valid()&&now>=f.next&&!std::any_of(frames.begin(),frames.end(),[](const auto& x){return x.pending.valid();})){
                try{f.pending=std::async(std::launch::async,Fetch,sources[i]);}
                catch(...){f.next=now+std::chrono::minutes(1);}
            }
            if(!f.image||now-f.received>std::chrono::minutes(20)){loading|=f.pending.valid();missing|=!f.pending.valid();continue;}
            Gdiplus::ColorMatrix tint={{{1,0,0,0,0},{0,1,0,0,0},{0,0,1,0,0},{0,0,0,i==2?.32f:i==0?.54f:.85f,0},{0,0,0,0,1}}};
            Gdiplus::ImageAttributes attributes;attributes.SetColorMatrix(&tint);
            graphics.DrawImage(f.image.get(),points,3,0,0,512,512,Gdiplus::UnitPixel,&attributes);
        }
        std::string caption="ECCC WX |";
        if(mask&Rain)caption+=" precip";
        if(mask&Lightning)caption+=" lightning density";
        if(mask&Vertical)caption+=" 700 hPa modeled vertical motion";
        if(loading||missing)caption+=loading?" | loading":" | layer unavailable";
        const int saved=SaveDC(dc);
        if(saved){SetBkMode(dc,OPAQUE);SetBkColor(dc,RGB(12,20,24));SetTextColor(dc,RGB(195,222,232));
            TextOutA(dc,clip.left+8,clip.bottom-24,caption.c_str(),static_cast<int>(caption.size()));RestoreDC(dc,saved);}
    }
};
}
